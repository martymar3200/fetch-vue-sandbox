import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RequestBatchJobDetails from 'src/components/Request/RequestBatchJobDetails.vue'
import { reactive, ref } from 'vue'
import { api } from 'src/boot/axios'
import { notify } from 'src/utils/notify'
import { usePicklistStore } from 'src/stores/picklist-store'
import { useRequestStore } from 'src/stores/request-store'


installQuasarPlugin()

const { mockDialog } = vi.hoisted(() => ({
  mockDialog: vi.fn()
}))

vi.mock('quasar', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useQuasar: () => ({
      dialog: mockDialog
    })
  }
})

const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => reactive({})),
  useRouter: vi.fn(() => ({ push: mockRouterPush }))
}))

vi.mock('@/composables/useCurrentScreenSize.js', () => ({
  useCurrentScreenSize: () => ({
    currentScreenSize: ref('xs')
  })
}))

vi.mock('@/composables/usePermissionHandler.js', () => ({
  usePermissionHandler: () => ({
    checkUserPermission: vi.fn().mockReturnValue(true)
  })
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

vi.mock('src/boot/axios', () => ({
  api: {
    delete: vi.fn()
  }
}))

describe('RequestBatchJobDetails', () => {
  let wrapper
  beforeEach(() => {
    vi.clearAllMocks()
  })
  describe('onBeforeMount', () => {
    it('should set requestTableVisibleColumns if screen size is xs', async () => {
      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      expect(
        wrapper.vm.requestTableVisibleColumns).toEqual([
        'id',
        'request_type',
        'barcode',
        'requestor_name'
      ])
    })
  })

  describe('getStatusColor', () => {
    it('returns the correct mapped color for different status inputs', () => {
      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      expect(wrapper.vm.getStatusColor('New')).toBe('info')

      expect(wrapper.vm.getStatusColor('Processing')).toBe('warning')

      expect(wrapper.vm.getStatusColor('Completed')).toBe('positive')

      expect(wrapper.vm.getStatusColor('Failed')).toBe('negative')

      expect(wrapper.vm.getStatusColor('Unknown')).toBe('grey')
    })
  })

  describe('headerSubtitle', () => {
    it('should compile the header subtitle based on state', () => {
      const mockFormatDateTime = vi.fn().mockReturnValue({ date: '8/31/2026' })

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': mockFormatDateTime,
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestBatchJob = {
        file_type: 'type',
        file_name: 'name',
        requests: [{ id: 1 }],
        user: {
          first_name: 'first',
          last_name: 'last'
        },
        create_dt: 'doesnt matter, mocked anyway'
      }

      expect(wrapper.vm.headerSubtitle).toBe(
        'type • name • 1 items • first last • 8/31/2026'
      )
    })
  })

  describe('confirmDeleteBatch', () => {
    it('should open the modal and, if succeeded delete api call, should call delete', async () => {
      mockDialog.mockReturnValue({
        onOk: vi.fn((callback) => {
          callback() // Immediately trigger OK
          return {
            onCancel: vi.fn(),
            onDismiss: vi.fn()
          }
        })
      })

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          },
          mocks: {
            $q: {
              dialog: mockDialog
            }
          }
        }
      })

      wrapper.vm.requestBatchJob = {
        id: 1
      }

      api.delete.mockReturnValue({})

      wrapper.vm.confirmDeleteBatch()

      await flushPromises()

      expect(mockDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Batch Upload'
        })
      )

      expect(api.delete).toHaveBeenCalled()
    })
    it('should open the modal with options and, if failed delete api call, should notify', async () => {
      mockDialog.mockReturnValue({
        onOk: vi.fn((callback) => {
          callback() // Immediately trigger OK
          return {
            onCancel: vi.fn(),
            onDismiss: vi.fn()
          }
        })
      })

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          },
          mocks: {
            $q: {
              dialog: mockDialog
            }
          }
        }
      })

      api.delete.mockRejectedValue({
        error: 'error'
      })

      wrapper.vm.confirmDeleteBatch()

      await flushPromises()

      expect(notify).toHaveBeenCalled()
    })
  })

  describe('loadRequestJob', () => {
    it('on success, route updates to request-details', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJob').mockResolvedValue()

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.loadRequestJob('1')

      await flushPromises()

      expect(mockRouterPush).toHaveBeenCalledWith(expect.objectContaining({ name: 'request-details' }))
    })

    it('on failure, should notify', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJob').mockRejectedValue({ error: 'error' })

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.loadRequestJob('1')

      await flushPromises()

      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
    })
  })

  describe('createPickListJob', async () => {
    it('on success, should notify and call getRequestBatchJob', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestBatchJob').mockResolvedValue()

      const picklistStore = usePicklistStore()
      vi.spyOn(picklistStore, 'postPicklistJob').mockResolvedValue()

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestTableComponent = {
        clearSelectedData: vi.fn()
      }

      wrapper.vm.createPickListJob()

      await flushPromises()

      expect(requestStore.getRequestBatchJob).toHaveBeenCalledWith(1)
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'positive' }))
    })


    it('on failure, should notify', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestBatchJob').mockRejectedValue({ error: 'error' })

      const picklistStore = usePicklistStore()
      vi.spyOn(picklistStore, 'postPicklistJob').mockRejectedValue({ error: 'error' })
      picklistStore.picklistJob = { requests: [] }

      wrapper = mount(RequestBatchJobDetails, {
        shallow: true,
        global: {
          provide: {
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestTableComponent = {
        clearSelectedData: vi.fn()
      }

      wrapper.vm.createPickListJob()

      await flushPromises()

      expect(requestStore.getRequestBatchJob).not.toHaveBeenCalledWith(1)
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
    })

    describe('updatePickListJob', () => {
      it('on success, should notify and call getRequestBatchJob', async () => {
        const requestStore = useRequestStore()
        vi.spyOn(requestStore, 'getRequestBatchJob').mockResolvedValue()

        const picklistStore = usePicklistStore()
        vi.spyOn(picklistStore, 'patchPicklistJobItem').mockResolvedValue()
        picklistStore.picklistJob = { requests: [] }


        const wrapper = mount(RequestBatchJobDetails, {
          shallow: true,
          global: {
            provide: {
              'format-date-time': vi.fn().mockReturnValue('N/A'),
              'get-item-location': vi.fn().mockReturnValue('N/A'),
              'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
            }
          }
        })

        wrapper.vm.addToPickListJob = 1
        wrapper.vm.selectedRequestItems = [{ id: 1 }]

        wrapper.vm.requestTableComponent = {
          clearSelectedData: vi.fn()
        }

        wrapper.vm.updatePickListJob()

        await flushPromises()

        expect(picklistStore.patchPicklistJobItem).toHaveBeenCalledWith({
          id: 1,
          request_ids: [1]
        })

        expect(requestStore.getRequestBatchJob).toHaveBeenCalledWith(1)
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'positive' }))
      })

      it('on failure, should notify', async () => {
        const requestStore = useRequestStore()
        vi.spyOn(requestStore, 'getRequestBatchJob').mockResolvedValue()

        const picklistStore = usePicklistStore()
        vi.spyOn(picklistStore, 'patchPicklistJobItem').mockRejectedValue({ error: 'error' })


        const wrapper = mount(RequestBatchJobDetails, {
          shallow: true,
          global: {
            provide: {
              'format-date-time': vi.fn().mockReturnValue('N/A'),
              'get-item-location': vi.fn().mockReturnValue('N/A'),
              'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
            }
          }
        })

        wrapper.vm.requestTableComponent = {
          clearSelectedData: vi.fn()
        }

        wrapper.vm.updatePickListJob()

        await flushPromises()

        expect(requestStore.getRequestBatchJob).not.toHaveBeenCalled()
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
      })
    })
  })

  describe('filters and sorting', () => {
    const requests = [
      {
        id: 2,
        status: 'New',
        requestor_name: 'Smith',
        request_type: { type: 'Scan' },
        item: { barcode: { value: 'B' } }
      },
      {
        id: 1,
        status: 'PickList',
        requestor_name: 'Jones',
        request_type: { type: 'General' },
        item: { barcode: { value: 'A' } }
      },
      {
        id: 3,
        status: 'New',
        deleted: true,
        requestor_name: 'Gone',
        item: { barcode: { value: 'C' } }
      }
    ]

    const mountDetails = async () => {
      useRequestStore().requestBatchJob = {
        id: 7,
        requests
      }
      wrapper = mount(RequestBatchJobDetails, {
        global: {
          // the quasar mock above has no $q.platform, which real buttons read
          stubs: {
            JobPageHeader: true,
            BaseButton: true
          },
          provide: {
            'format-date-time': vi.fn().mockReturnValue({ date: 'N/A' }),
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn(item => item?.barcode?.value ?? '')
          }
        }
      })
      await flushPromises()
    }

    const firstCellOfEachRow = () => wrapper.findAll('tbody tr').map(row => row.find('td').text())

    it('renders a filter input for the visible columns', async () => {
      await mountDetails()
      expect(wrapper.find('.filter-row').exists()).toBe(true)
      expect(wrapper.find('input[aria-label="Filter by Requestor Name"]').exists()).toBe(true)
    })

    it('filters rows as a filter changes', async () => {
      await mountDetails()
      await wrapper.find('input[aria-label="Filter by Requestor Name"]').setValue('smi')
      await flushPromises()
      expect(firstCellOfEachRow()).toEqual(['2'])
    })

    it('leaves out deleted requests', async () => {
      await mountDetails()
      expect(wrapper.vm.requestItems.map(r => r.id)).toEqual([
        2,
        1
      ])
      expect(wrapper.vm.statusOptionsFromData.map(o => o.value)).toEqual([
        'New',
        'PickList'
      ])
    })

    it('sorts by a clicked column, ascending then descending', async () => {
      await mountDetails()
      const header = wrapper.find('[aria-label="Requestor NameTableColumnSortAscendDescend"]')
      await header.trigger('click')
      await flushPromises()
      expect(firstCellOfEachRow()).toEqual([
        '1',
        '2'
      ])
      await header.trigger('click')
      await flushPromises()
      expect(firstCellOfEachRow()).toEqual([
        '2',
        '1'
      ])
    })
  })
})
