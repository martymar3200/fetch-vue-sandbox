import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PicklistExecute from 'src/components/Picklist/PicklistExecute.vue'
import JobConfirmDialog from 'src/components/Job/JobConfirmDialog.vue'
import MobileActionBar from 'src/components/MobileActionBar.vue'
import { usePicklistStore } from 'src/stores/picklist-store'
import { notify } from '@/utils/notify'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import { ref } from 'vue'

installQuasarPlugin()

const compiledBarCode = ref('')
const currentScreenSize = ref('md')

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { jobId: 5 } })),
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/composables/useBarcodeScanHandler.js', () => ({
  useBarcodeScanHandler: () => ({ compiledBarCode })
}))

vi.mock('@/composables/useCurrentScreenSize.js', () => ({
  useCurrentScreenSize: () => ({ currentScreenSize })
}))

vi.mock('@/composables/usePermissionHandler.js', () => ({
  usePermissionHandler: () => ({
    checkUserPermission: vi.fn().mockReturnValue(true)
  })
}))

vi.mock('@/composables/useIndexDbHandler.js', () => ({
  useIndexDbHandler: () => ({
    addDataToIndexDb: vi.fn(),
    deleteDataInIndexDb: vi.fn()
  })
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

const BARCODE = 'ITEM-1'

const mounted = []
const mountPage = (status = 'Running', itemStatus = 'PickList', fulfilled = itemStatus !== 'PickList') => {
  usePicklistStore().picklistJob = {
    id: 5,
    status,
    requests: [
      {
        id: 11,
        fulfilled,
        item: {
          status: itemStatus,
          barcode: { value: BARCODE }
        }
      }
    ]
  }
  const wrapper = mount(PicklistExecute, {
    global: {
      provide: {
        'current-iso-date': () => '2026-11-01T12:00:00Z',
        'render-item-barcode-display': row => row?.barcode?.value,
        'get-item-location': () => '-'
      },
      stubs: {
        JobPageHeader: true,
        JobConfirmDialog: true,
        MobileActionBar: true,
        AuditTrail: true,
        PicklistBatchSheet: true,
        PicklistItemDetailModal: true
      }
    }
  })
  mounted.push(wrapper)
  return wrapper
}

const serverError = detail => ({ response: { data: { detail } } })

describe('PicklistExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compiledBarCode.value = ''
    currentScreenSize.value = 'md'
  })

  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('shows the reason the server refused to complete the job', async () => {
    const detail = 'Pick List 5 can not be completed: 1 item(s) have not been scanned'
    usePicklistStore().patchPicklistJob.mockRejectedValue(serverError(detail))
    const wrapper = mountPage('Running', 'Out')
    await flushPromises()

    wrapper.findAllComponents(JobConfirmDialog)[0].vm.$emit('confirm', false)
    await flushPromises()

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'negative',
      message: detail
    }))
  })

  it('shows the reason the server refused a scan', async () => {
    const detail = 'Can not retrieve items on a \'Created\' Pick List'
    usePicklistStore().patchPicklistJobItemScanned.mockRejectedValue(serverError(detail))
    mountPage()
    await flushPromises()

    compiledBarCode.value = BARCODE
    await flushPromises()

    expect(usePicklistStore().patchPicklistJobItemScanned).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'negative',
      message: detail
    }))
  })

  it('falls back to its own message when the server gives no reason', async () => {
    usePicklistStore().patchPicklistJob.mockRejectedValue({})
    const wrapper = mountPage('Running', 'Out')
    await flushPromises()

    wrapper.findAllComponents(JobConfirmDialog)[0].vm.$emit('confirm', false)
    await flushPromises()

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Failed to complete job'
    }))
  })

  describe('retrieved state comes from the request, not the item\'s current status', () => {
    const shown = wrapper => wrapper.text()

    it('shows a completed job as retrieved after its item was picked again on a later job', async () => {
      const wrapper = mountPage('Completed', 'PickList', true)
      await flushPromises()

      expect(shown(wrapper)).toContain('1/1')
      expect(wrapper.find('.q-chip').text()).toContain('Retrieved')
    })

    it('shows a completed job as retrieved with shipping on, where requests stay unfulfilled', async () => {
      const wrapper = mountPage('Completed', 'Retrieved', false)
      await flushPromises()

      expect(shown(wrapper)).toContain('1/1')
    })

    it('still lists an item under the Retrieved filter once it has moved past Out', async () => {
      const wrapper = mountPage('Completed', 'In', true)
      await flushPromises()

      wrapper.findComponent({ name: 'QBtnToggle' }).vm.$emit('update:modelValue', 'retrieved')
      await flushPromises()

      expect(wrapper.find('.q-chip').text()).toContain('Retrieved')
    })

    it('treats an unfulfilled item on a running job as pending whatever its status', async () => {
      const wrapper = mountPage('Running', 'Requested', false)
      await flushPromises()

      expect(shown(wrapper)).toContain('0/1')
      expect(wrapper.text()).toContain('CURRENT TARGET')
    })

    it('blocks a repeat scan of an item this job already retrieved', async () => {
      mountPage('Running', 'Out', true)
      await flushPromises()

      compiledBarCode.value = BARCODE
      await flushPromises()

      expect(usePicklistStore().patchPicklistJobItemScanned).not.toHaveBeenCalled()
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Item already retrieved' }))
    })
  })

  describe('a scan arriving while another is saving', () => {
    const scanWhileSaving = async (barcode) => {
      let finishSaving
      usePicklistStore().patchPicklistJobItemScanned.mockReturnValue(new Promise((resolve) => {
        finishSaving = resolve
      }))
      mountPage()
      await flushPromises()
      compiledBarCode.value = BARCODE
      await flushPromises()
      compiledBarCode.value = ''
      await flushPromises()
      compiledBarCode.value = barcode
      await flushPromises()
      finishSaving()
      await flushPromises()
    }

    it('asks for a different item to be scanned again', async () => {
      await scanWhileSaving('ITEM-2')

      expect(usePicklistStore().patchPicklistJobItemScanned).toHaveBeenCalledTimes(1)
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'warning',
        message: expect.stringContaining('ITEM-2')
      }))
    })

    it('stays quiet about a double read of the same item', async () => {
      await scanWhileSaving(BARCODE)

      expect(usePicklistStore().patchPicklistJobItemScanned).toHaveBeenCalledTimes(1)
      expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
    })
  })

  it.each([
    [
      'Running',
      false
    ],
    [
      'Paused',
      true
    ]
  ])('mobile Complete on a %s job with everything scanned: disabled is %s', async (status, disabled) => {
    currentScreenSize.value = 'xs'
    const wrapper = mountPage(status, 'Out')
    await flushPromises()

    expect(wrapper.findComponent(MobileActionBar).props('buttonTwoDisabled')).toBe(disabled)
  })
})
