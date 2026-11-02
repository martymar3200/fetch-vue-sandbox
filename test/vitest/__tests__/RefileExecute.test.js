import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RefileExecute from 'src/components/Refile/RefileExecute.vue'
import { useRefileStore } from 'src/stores/refile-store'
import { notify } from '@/utils/notify'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import { ref } from 'vue'

installQuasarPlugin()

const compiledBarCode = ref('')

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/composables/useBarcodeScanHandler', () => ({
  useBarcodeScanHandler: () => ({ compiledBarCode })
}))

vi.mock('@/composables/usePermissionHandler', () => ({
  usePermissionHandler: () => ({
    checkUserPermission: vi.fn().mockReturnValue(true)
  })
}))

vi.mock('@/composables/useIndexDbHandler', () => ({
  useIndexDbHandler: () => ({
    addDataToIndexDb: vi.fn(),
    getDataInIndexDb: vi.fn(),
    deleteDataInIndexDb: vi.fn()
  })
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

const PENDING = {
  id: 1,
  status: 'Out',
  barcode: { value: 'PENDING-1' },
  tray: {
    barcode: { value: 'TRAY-1' },
    shelf_position: { location: 'B-1-1-L-1-1-1' }
  }
}
const REFILED = {
  id: 2,
  status: 'In',
  barcode: { value: 'REFILED-2' },
  tray: {
    barcode: { value: 'TRAY-2' },
    shelf_position: { location: 'B-1-1-L-1-1-2' }
  }
}

const JobPageHeader = {
  name: 'JobPageHeader',
  props: ['menuOptions'],
  template: '<div><slot name="actions" /></div>'
}
const RefileVerifyModal = {
  name: 'RefileVerifyModal',
  props: ['item'],
  template: '<div class="verify-modal" />'
}

const mounted = []
const mountPage = (status = 'Running') => {
  useRefileStore().refileJob = {
    id: 7,
    status,
    refile_job_items: [
      { ...PENDING },
      { ...REFILED }
    ]
  }
  const wrapper = mount(RefileExecute, {
    props: { jobId: 7 },
    global: {
      provide: { 'current-iso-date': () => '2026-11-02T12:00:00Z' },
      stubs: {
        JobPageHeader,
        RefileVerifyModal,
        JobActionButtons: true,
        JobConfirmDialog: true,
        MobileActionBar: true,
        AuditTrail: true,
        RefileBatchSheet: true
      }
    }
  })
  mounted.push(wrapper)
  return wrapper
}

const refusal = detail => ({
  response: {
    status: 400,
    data: { detail }
  }
})

const revertSelected = async (wrapper, rows) => {
  wrapper.findComponent(JobPageHeader).props('menuOptions')
    .find(option => option.label == 'Edit Items')
    .action()
  await flushPromises()
  wrapper.findComponent({ name: 'QTable' }).vm.$emit('update:selected', rows)
  await flushPromises()
  const button = wrapper.findAll('button').find(btn => btn.text().includes('Revert Items to Queue'))
  await button.trigger('click')
  await flushPromises()
}

const sentBarcodes = () => useRefileStore().deleteRefileJobItems.mock.calls[0][0].barcode_values

describe('RefileExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compiledBarCode.value = ''
  })

  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
  })

  describe('reverting selected items to the queue', () => {
    it('sends pending items', async () => {
      const wrapper = mountPage()
      await flushPromises()

      await revertSelected(wrapper, [PENDING])

      expect(sentBarcodes()).toEqual(['PENDING-1'])
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Items reverted to queue' }))
    })

    it('leaves refiled items in the job and says so', async () => {
      const wrapper = mountPage()
      await flushPromises()

      await revertSelected(wrapper, [
        PENDING,
        REFILED
      ])

      expect(sentBarcodes()).toEqual(['PENDING-1'])
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Reverted 1 item to the queue. 1 refiled item stays in the job.'
      }))
    })

    it('sends nothing when only refiled items are selected', async () => {
      const wrapper = mountPage()
      await flushPromises()

      await revertSelected(wrapper, [REFILED])

      expect(useRefileStore().deleteRefileJobItems).not.toHaveBeenCalled()
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'warning',
        message: 'Refiled items stay in the job and can not be reverted to the queue.'
      }))
    })

    it('shows the server\'s reason and reloads the job when the revert is refused', async () => {
      const detail = 'Refiled items can not be reverted to the queue: PENDING-1'
      useRefileStore().deleteRefileJobItems.mockRejectedValue(refusal(detail))
      const wrapper = mountPage()
      await flushPromises()
      useRefileStore().getRefileJob.mockClear()

      await revertSelected(wrapper, [PENDING])

      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'negative',
        message: detail
      }))
      expect(useRefileStore().getRefileJob).toHaveBeenCalledWith(7)
    })
  })

  describe('a refile scan', () => {
    const openVerify = async () => {
      const wrapper = mountPage()
      await flushPromises()
      compiledBarCode.value = 'PENDING-1'
      await flushPromises()
      useRefileStore().getRefileJob.mockClear()
      return wrapper
    }

    it('shows the server\'s reason, reloads the job and closes the check when refused', async () => {
      const detail = 'Can not scan items in Refile Job ID 7 in \'Paused\' status'
      useRefileStore().patchRefileJobTrayItemScanned.mockRejectedValue(refusal(detail))
      const wrapper = await openVerify()

      wrapper.findComponent(RefileVerifyModal).vm.$emit('verify', PENDING)
      await flushPromises()

      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'negative',
        message: detail
      }))
      expect(useRefileStore().getRefileJob).toHaveBeenCalledWith(7)
      expect(wrapper.findComponent(RefileVerifyModal).exists()).toBe(false)
    })

    it('keeps the check open to retry when the server or network fails', async () => {
      useRefileStore().patchRefileJobTrayItemScanned.mockRejectedValue({
        response: {
          status: 503,
          data: {}
        }
      })
      const wrapper = await openVerify()

      wrapper.findComponent(RefileVerifyModal).vm.$emit('verify', PENDING)
      await flushPromises()

      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to update item' }))
      expect(useRefileStore().getRefileJob).not.toHaveBeenCalled()
      expect(wrapper.findComponent(RefileVerifyModal).exists()).toBe(true)
    })
  })
})
