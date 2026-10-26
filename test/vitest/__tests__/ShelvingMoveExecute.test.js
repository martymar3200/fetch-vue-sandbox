import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShelvingMoveExecute from 'src/components/Shelving/ShelvingMoveExecute.vue'
import JobConfirmDialog from 'src/components/Job/JobConfirmDialog.vue'
import { useShelvingStore } from 'src/stores/shelving-store'
import { useBarcodeStore } from 'src/stores/barcode-store'
import { useGlobalStore } from 'src/stores/global-store'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import { reactive, ref } from 'vue'

installQuasarPlugin()

const route = reactive({ params: {} })
const compiledBarCode = ref('')

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => route),
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/composables/useBarcodeScanHandler.js', () => ({
  useBarcodeScanHandler: () => ({ compiledBarCode })
}))

vi.mock('@/composables/usePermissionHandler.js', () => ({
  usePermissionHandler: () => ({
    checkUserPermission: vi.fn().mockReturnValue(true)
  })
}))

vi.mock('@/composables/useIndexDbHandler.js', () => ({
  useIndexDbHandler: () => ({
    addDataToIndexDb: vi.fn(),
    getDataInIndexDb: vi.fn().mockResolvedValue({ data: {} }),
    deleteDataInIndexDb: vi.fn()
  })
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

const SHELF = '123456'
const TRAY = 'AB12345'

// Pages still mounted from earlier tests would also react to the shared scanner ref
const mounted = []
const mountPage = () => {
  const wrapper = mountPageOnce()
  mounted.push(wrapper)
  return wrapper
}

const mountPageOnce = () => mount(ShelvingMoveExecute, {
  global: {
    provide: {
      'current-iso-date': () => '2026-10-26T12:00:00Z',
      'get-item-location': row => row.shelf_position?.location || '-'
    },
    stubs: {
      JobPageHeader: true,
      JobProgressBar: true,
      JobActionButtons: true,
      AuditTrail: true
    }
  }
})

// The page reacts to scanner input through compiledBarCode
const scan = async (value) => {
  compiledBarCode.value = value
  await flushPromises()
  compiledBarCode.value = ''
  await flushPromises()
}

const positionInput = wrapper => wrapper.find('input[type="number"]')

const setUp = ({ type = 'tray-non-tray', offline = false } = {}) => {
  route.params = {
    type,
    jobId: 5
  }
  useGlobalStore().appIsOffline = offline

  const shelvingStore = useShelvingStore()
  shelvingStore.shelvingJob = {
    id: 5,
    status: 'Running',
    origin: 'Move',
    mode: type === 'tray-item' ? 'MoveTrayItem' : 'MoveShelf',
    shelving_job_containers: []
  }
  shelvingStore.getShelvingJob.mockResolvedValue()
  shelvingStore.getShelfByBarcode.mockImplementation(async (barcode) => {
    shelvingStore.shelvingJob.nextAvailablePosition = offline ? null : 2
    return {
      data: {
        id: offline ? null : 9,
        barcode: { value: barcode },
        location: offline ? barcode : 'M1-A1-L-1-S1',
        owner: { name: offline ? 'Offline (Pending Sync)' : 'Owner A' },
        shelf_type: { size_class: { name: 'Small' } }
      }
    }
  })
  shelvingStore.getShelvingTrayContainerDetails.mockResolvedValue({
    data: {
      id: 10,
      barcode: { value: TRAY },
      owner: { name: 'Owner A' },
      size_class: { name: 'Small' }
    }
  })
  shelvingStore.getShelvingTrayItemDetails.mockResolvedValue({
    data: {
      id: 20,
      barcode: { value: '1234567890A' },
      owner: { name: 'Owner A' }
    }
  })

  const barcodeStore = useBarcodeStore()
  barcodeStore.verifyBarcode.mockResolvedValue('barcode_exists')
  barcodeStore.barcodeDetails = { type: { name: 'Tray' } }

  return shelvingStore
}

describe('ShelvingMoveExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compiledBarCode.value = ''
  })

  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('saves each move as soon as the container is scanned', async () => {
    const store = setUp()
    store.postShelvingJobContainer.mockResolvedValue({
      fromServer: true,
      data: {
        shelving_container_id: 77,
        next_available_position: 3
      }
    })
    const wrapper = mountPage()
    await flushPromises()

    await scan(SHELF)
    expect(positionInput(wrapper).element.value).toBe('2')

    await scan(TRAY)

    expect(store.postShelvingJobContainer).toHaveBeenCalledTimes(1)
    expect(store.postShelvingJobContainer).toHaveBeenCalledWith(expect.objectContaining({
      job_id: 5,
      container_barcode_value: TRAY,
      shelf_barcode_value: SHELF,
      shelf_position_number: 2,
      trayed: true
    }))
    expect(wrapper.text()).toContain('Moved')
    // Next position comes from the server response
    expect(positionInput(wrapper).element.value).toBe('3')
  })

  it('shows a rejected move right away and adds no row', async () => {
    const store = setUp()
    store.postShelvingJobContainer.mockRejectedValue({
      response: { data: { detail: 'Shelf Position M1-A1-L-1-S1-2 is already occupied' } }
    })
    const wrapper = mountPage()
    await flushPromises()

    await scan(SHELF)
    await scan(TRAY)

    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('already occupied')
    expect(wrapper.text()).not.toContain('Moved')
    expect(wrapper.text()).toContain('No containers moved yet')
    expect(positionInput(wrapper).element.value).toBe('2')
  })

  it('blocks the move when the shelf is full', async () => {
    const store = setUp()
    store.getShelfByBarcode.mockImplementation(async (barcode) => {
      store.shelvingJob.nextAvailablePosition = null
      return {
        data: {
          id: 9,
          barcode: { value: barcode },
          location: 'M1-A1-L-1-S1',
          owner: { name: 'Owner A' },
          shelf_type: { size_class: { name: 'Small' } }
        }
      }
    })
    const wrapper = mountPage()
    await flushPromises()

    await scan(SHELF)
    await scan(TRAY)

    expect(store.postShelvingJobContainer).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toContain('Shelf is full')
  })

  it('queues the move offline and marks it Queued', async () => {
    const store = setUp({ offline: true })
    store.postShelvingJobContainer.mockResolvedValue({ fromServer: false })
    const barcodeStore = useBarcodeStore()
    const wrapper = mountPage()
    await flushPromises()

    await scan(SHELF)
    await positionInput(wrapper).setValue('4')
    await scan(TRAY)

    // Lookups need the server, so they are skipped offline
    expect(barcodeStore.verifyBarcode).not.toHaveBeenCalled()
    expect(store.postShelvingJobContainer).toHaveBeenCalledWith(expect.objectContaining({
      container_barcode_value: TRAY,
      shelf_barcode_value: SHELF,
      shelf_position_number: 4
    }))
    expect(wrapper.text()).toContain('Queued (offline)')
    expect(positionInput(wrapper).element.value).toBe('5')
  })

  it('moves an item into the scanned tray on scan (Move Tray Item)', async () => {
    const store = setUp({ type: 'tray-item' })
    store.postShelvingJobContainer.mockResolvedValue({
      fromServer: true,
      data: { shelving_container_id: 88 }
    })
    const wrapper = mountPage()
    await flushPromises()

    await scan(TRAY)
    await scan('1234567890A')

    expect(store.postShelvingJobContainer).toHaveBeenCalledTimes(1)
    const payload = store.postShelvingJobContainer.mock.calls[0][0]
    expect(payload).toMatchObject({
      container_barcode_value: '1234567890A',
      destination_tray_barcode_value: TRAY
    })
    expect(payload.shelf_barcode_value).toBeUndefined()
    expect(wrapper.text()).toContain('Moved')
  })

  it('Complete only closes the job; moves were already saved', async () => {
    const store = setUp()
    store.postShelvingJobContainer.mockResolvedValue({
      fromServer: true,
      data: { next_available_position: 3 }
    })
    store.patchShelvingJob.mockResolvedValue()
    const wrapper = mountPage()
    await flushPromises()

    await scan(SHELF)
    await scan(TRAY)
    expect(store.postShelvingJobContainer).toHaveBeenCalledTimes(1)

    wrapper.findAllComponents(JobConfirmDialog)[0].vm.$emit('confirm')
    await flushPromises()

    expect(store.postShelvingJobContainer).toHaveBeenCalledTimes(1)
    expect(store.patchShelvingJob).toHaveBeenCalledWith(expect.objectContaining({
      id: 5,
      status: 'Completed'
    }))
  })
})
