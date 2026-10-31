import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount } from '@vue/test-utils'
import RequestDashboard from 'src/components/Request/RequestDashboard.vue'
import { useIlsConfigurationStore } from 'src/stores/ils-configuration-store'
import { usePicklistStore } from 'src/stores/picklist-store'
import { useOptionStore } from 'src/stores/option-store'
import { useRequestStore } from 'src/stores/request-store'
import { useUserStore } from 'src/stores/user-store'
import { notify } from 'src/utils/notify'
import { vi, describe, beforeEach } from 'vitest'
import { reactive, ref } from 'vue'

installQuasarPlugin()

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

describe('RequestDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  let wrapper
  describe('onBeforeMount', () => {
    it('should call requestTableVisibleColumns if screen size is xs', async () => {
      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      expect(
        JSON.stringify(wrapper.vm.requestTableVisibleColumns) ===
          JSON.stringify([
            'id',
            'request_type',
            'barcode_value',
            'requestor_name'
          ])
      ).toBeTruthy()
    })
  })
  describe('handlePickListModalOpen', () => {
    it('when user has no default building set, show picklistModal', async () => {
      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      useUserStore().userData = {
        user_id: 123,
        default_building_id: null
      }

      wrapper.vm.handlePickListModalOpen('Create')

      expect(wrapper.vm.showPickListModal === 'Create').toBeTruthy()
    })

    it('when user has building set, should call getRequestJobList', async () => {
      useUserStore().userData = {
        default_building_id: 2,
        permissions: []
      }

      const requestStore = useRequestStore()
      requestStore.getRequestJobList.mockResolvedValue({})

      let wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })


      await wrapper.vm.handlePickListModalOpen('Create')

      expect(requestStore.getRequestJobList).toHaveBeenCalled()
    })

    it('when user has building set, should call getRequestJobList', async () => {
      useUserStore().userData = {
        default_building_id: 2,
        permissions: []
      }

      const requestStore = useRequestStore()
      requestStore.getRequestJobList.mockResolvedValue({})

      let wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.picklistModalComponent = ref('val')

      await wrapper.vm.handlePickListModalOpen('Create')

      expect(requestStore.getRequestJobList).toHaveBeenCalled()
    })

    it('when user has building set, and getRequestJobList fails, should notify', async () => {
      useUserStore().userData = {
        default_building_id: 2,
        permissions: []
      }

      const requestStore = useRequestStore()
      requestStore.getRequestJobList.mockRejectedValue(new Error('error'))

      let wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })


      await wrapper.vm.handlePickListModalOpen('Create')

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'negative' })
      )
    })

    it('when adding with a default building set, applies it and shows only the pick list modal', async () => {
      useUserStore().userData = {
        default_building_id: 2,
        permissions: []
      }

      const requestStore = useRequestStore()
      requestStore.getRequestJobList.mockResolvedValue({})

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      // ignore the dashboard's initial load
      requestStore.getRequestJobList.mockClear()

      await wrapper.vm.handlePickListModalOpen('Add')

      expect(wrapper.vm.filterRequestsByBuilding).toBe(2)
      expect(wrapper.vm.showPickListModal).toBe('Add')
      expect(wrapper.vm.showAddPickList).toBe(false)
      expect(requestStore.getRequestJobList).not.toHaveBeenCalled()
    })

    it('when adding with no default building set, shows the building and pick list modal', async () => {
      useUserStore().userData = {
        default_building_id: null,
        permissions: []
      }

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.handlePickListModalOpen('Add')

      expect(wrapper.vm.filterRequestsByBuilding).toBeNull()
      expect(wrapper.vm.showPickListModal).toBe('Add')
    })
  })

  describe('triggerIlsSyncModalOpen', () => {
    it('should fetch ILS configurations', async () => {
      const ilsStore = useIlsConfigurationStore()
      vi.spyOn(ilsStore, 'getIlsConfigurations').mockResolvedValue([{ id: 1 }])

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.triggerIlsSyncModalOpen()

      expect(wrapper.vm.loadingIlsConfigs).toBe(false)
    })

    it('on error, should notify', async () => {
      const ilsStore = useIlsConfigurationStore()
      vi.spyOn(ilsStore, 'getIlsConfigurations').mockRejectedValue(new Error('error'))

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.triggerIlsSyncModalOpen()

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'negative' })
      )
    })
  })

  describe('submitIlsSyncRequest', () => {
    it('should syncs requests and closes modal', async () => {
      const ilsStore = useIlsConfigurationStore()
      vi.spyOn(ilsStore, 'syncIlsRequests').mockResolvedValue(true)

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.selectedIlsConfigsToSync = [1]
      await wrapper.vm.submitIlsSyncRequest()

      expect(ilsStore.syncIlsRequests).toHaveBeenCalled()
      expect(wrapper.vm.showSyncIlsRequestsModal).toBe(false)
    })

    it('should notify on failure', async () => {
      const ilsStore = useIlsConfigurationStore()
      vi.spyOn(ilsStore, 'syncIlsRequests').mockRejectedValue(new Error('Sync error'))

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.submitIlsSyncRequest()

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to trigger ILS Sync' })
      )
    })
  })

  describe('loadRequestJobs', () => {
    it('if not in picklist mode, should call getRequestJobList', async () => {
      wrapper.vm.requestDisplayType = 'request_view'
      const requestStore = useRequestStore()
      const spy = vi.spyOn(requestStore, 'getRequestJobList').mockResolvedValue([])

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.loadRequestJobs()

      expect(spy).toHaveBeenCalled()
    })

    it('should apply picklist filters if in picklist mode', async () => {
      const requestStore = useRequestStore()
      const spy = vi.spyOn(requestStore, 'getRequestJobList').mockResolvedValue([])

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.showCreatePickList = false
      wrapper.vm.columnFilters = {
        id: 123,
        request_type: ['test'],
        barcode: '123',
        external_request_id: '123',
        building_id: [
          1,
          2
        ],
        requestor_name: 'test',
        status: ['test'],
        priority: ['test'],
        media_type: ['test'],
        delivery_location: ['test'],
        location: 'place'
      }

      await wrapper.vm.loadRequestJobs({ page: 1 })

      expect(spy).toHaveBeenCalledWith({
        page: 1,
        queue: true,
        unassociated_pick_list: false,
        id: 123,
        request_type: ['test'],
        barcode_value: '123',
        external_request_id: '123',
        building_id: [
          1,
          2
        ],
        requestor_name: 'test',
        status: ['test'],
        priority: ['test'],
        media_type: ['test'],
        delivery_location: ['test'],
        item_location: 'place'
      })
    })

    it('if not in piclist mode, should call getRequestBatchJobList', async () => {
      const requestStore = useRequestStore()
      const spy = vi.spyOn(requestStore, 'getRequestBatchJobList').mockResolvedValue([])

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestDisplayType = 'batch_view'

      wrapper.vm.batchColumnFilters = {
        file_type: 'type',
        status: ['status'],
        user_name: 'name'
      }

      await wrapper.vm.loadRequestJobs({ sort: 'desc' })

      expect(spy).toHaveBeenCalledWith({
        sort: 'desc',
        file_type_search: 'type',
        status: ['status'],
        user_name_search: 'name'
      })
    })

    it('on api failure, notifies', async () => {
      wrapper.vm.requestDisplayType = 'request_view'
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJobList').mockRejectedValue(new Error('error'))

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.loadRequestJobs()

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'negative' })
      )
    })
  })

  describe('applyColumnFilters', () => {
    it('reloads from the first page through the table, which keeps the sort and page size', () => {
      const reloadSpy = vi.fn()

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestTableComponent = { reloadFromFirstPage: reloadSpy }

      wrapper.vm.applyColumnFilters()

      expect(reloadSpy).toHaveBeenCalled()
    })
  })

  describe('clearColumnFilters', () => {
    it('if in request view, should clear columnFilters props', () => {
      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestDisplayType = 'request_view'
      wrapper.vm.columnFilters.id = 99

      wrapper.vm.clearColumnFilters()

      expect(wrapper.vm.columnFilters.id).toBeNull()
    })

    it('if not in request view, should reset batchColumnFilters props', () => {
      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestDisplayType = 'batch_view'
      wrapper.vm.batchColumnFilters.file_type = 'type'

      wrapper.vm.clearColumnFilters()

      expect(wrapper.vm.batchColumnFilters.file_type).toBeNull()
    })
  })

  describe('loadRequestJob', () => {
    it('if requestDisplayType is batch_view, routes to batch-details', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestBatchJob').mockResolvedValue({})

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestDisplayType = 'batch_view'

      await wrapper.vm.loadRequestJob(1)

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'request-batch' })
      )
    })

    it('if requestDisplayType is request_view, routes to request-details', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJob').mockResolvedValue({})

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestDisplayType = 'request_view'

      await wrapper.vm.loadRequestJob(1)

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'request-details' })
      )
    })

    it('if error on getRequestJob, notifies', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJob').mockRejectedValue(new Error('Not found'))

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestDisplayType = 'request_view'

      await wrapper.vm.loadRequestJob(1)

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'negative' })
      )
    })
  })

  describe('createPickListJob', () => {
    it('should notify of success', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJobList').mockResolvedValue([])

      const picklistStore = usePicklistStore()
      vi.spyOn(picklistStore, 'postPicklistJob').mockResolvedValue()

      picklistStore.picklistJob = {
        id: 1,
        requests: [
          {
            non_tray_item: {
              status: 'status'
            }
          }
        ]
      }

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.selectedRequestItems = [{ id: 1 }]
      wrapper.vm.requestTableComponent = {
        resetTablePagination: vi.fn(),
        clearSelectedData: vi.fn()
      }

      await wrapper.vm.createPickListJob()

      expect(picklistStore.postPicklistJob).toHaveBeenCalled()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'positive' })
      )
    })

    it('should notify on failure', async () => {
      const picklistStore = usePicklistStore()
      vi.spyOn(picklistStore, 'postPicklistJob').mockRejectedValue(new Error('error'))

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      wrapper.vm.requestTableComponent = {
        resetTablePagination: vi.fn(),
        clearSelectedData: vi.fn()
      }

      await wrapper.vm.createPickListJob()

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'negative' })
      )
    })
  })

  describe('updatePickListJob', () => {
    it('should patch picklist items successfully, and notify of success', async () => {
      const picklistStore = usePicklistStore()
      vi.spyOn(picklistStore, 'patchPicklistJobItem').mockResolvedValue()

      picklistStore.picklistJob = {
        id: 1,
        requests: [
          {
            non_tray_item: {
              status: 'status'
            }
          }
        ]
      }

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.updatePickListJob()

      expect(picklistStore.patchPicklistJobItem).toHaveBeenCalled()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'positive' })
      )
    })

    it('should notify on failure', async () => {
      const picklistStore = usePicklistStore()
      vi.spyOn(picklistStore, 'patchPicklistJobItem').mockRejectedValue(new Error('error'))

      wrapper = mount(RequestDashboard, {
        global: {
          provide: {
            'get-item-location': vi.fn().mockReturnValue('N/A'),
            'format-date-time': vi.fn().mockReturnValue('N/A'),
            'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
            'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
          }
        }
      })

      await wrapper.vm.updatePickListJob()

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'negative' })
      )
    })
  })

  describe('filters and sorting', () => {
    const mountDashboard = () => mount(RequestDashboard, {
      global: {
        provide: {
          'get-item-location': vi.fn().mockReturnValue('N/A'),
          'format-date-time': vi.fn().mockReturnValue({ date: 'N/A' }),
          'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
          'render-item-barcode-display': vi.fn().mockReturnValue('N/A')
        }
      }
    })

    let listSpy
    beforeEach(() => {
      useUserStore().userData = { permissions: [] }
      useRequestStore().requestJobList = []
      listSpy = vi.spyOn(useRequestStore(), 'getRequestJobList').mockResolvedValue()
      const optionStore = useOptionStore()
      optionStore.$reset()
      vi.spyOn(optionStore, 'getOptions').mockResolvedValue()
    })

    it('offers every lookup value in the dropdowns, not just those on the current page', () => {
      const optionStore = useOptionStore()
      optionStore.requestsTypes = [
        { type: 'General' },
        { type: 'Scan' }
      ]
      optionStore.requestsPriorities = [
        { value: 'High' },
        { value: 'Low' }
      ]
      useRequestStore().requestJobList = [
        {
          id: 1,
          status: 'New',
          request_type: { type: 'General' },
          priority: { value: 'High' }
        }
      ]

      wrapper = mountDashboard()

      expect(wrapper.vm.requestTypeOptions.map(o => o.value)).toEqual([
        'General',
        'Scan'
      ])
      expect(wrapper.vm.priorityOptions.map(o => o.value)).toEqual([
        'High',
        'Low'
      ])
      expect(wrapper.vm.requestStatusOptions.map(o => o.value)).toContain('Retrieved')
    })

    it('loads lookups that are missing and leaves loaded ones alone', () => {
      const optionStore = useOptionStore()
      optionStore.buildings = [{ id: 1 }]

      wrapper = mountDashboard()

      const loaded = optionStore.getOptions.mock.calls.map(call => call[0])
      expect(loaded).toContain('requestsTypes')
      expect(loaded).not.toContain('buildings')
    })

    it('offers the Uploaded batch status', () => {
      wrapper = mountDashboard()
      expect(wrapper.vm.batchStatusOptions.map(o => o.value)).toContain('Uploaded')
    })

    it('sends the location search as it is displayed', async () => {
      wrapper = mountDashboard()
      wrapper.vm.columnFilters.location = '01-02-R-1'

      await wrapper.vm.loadRequestJobs()

      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ item_location: '01-02-R-1' }))
    })

    it('only leaves the queue when a Completed filter asks for fulfilled requests', async () => {
      wrapper = mountDashboard()

      wrapper.vm.columnFilters.status = ['New']
      await wrapper.vm.loadRequestJobs()
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({ queue: true }))

      wrapper.vm.columnFilters.status = ['Completed']
      await wrapper.vm.loadRequestJobs()
      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        queue: false,
        status: ['Completed']
      }))
    })

    it('clearing a text filter reloads the table', async () => {
      wrapper = mountDashboard()
      wrapper.vm.showFilterRow = true
      await wrapper.vm.$nextTick()
      const input = wrapper.findAllComponents({ name: 'QInput' })
        .find(field => field.attributes('aria-label') === 'Filter by Requestor Name' || field.find('input[aria-label="Filter by Requestor Name"]').exists())
      const reloadSpy = vi.fn()
      wrapper.vm.requestTableComponent = { reloadFromFirstPage: reloadSpy }

      input.vm.$emit('clear')

      expect(reloadSpy).toHaveBeenCalled()
    })

    it('applies column filters and the chosen building from the start of pick list mode', async () => {
      useUserStore().userData = {
        default_building_id: 2,
        permissions: []
      }
      wrapper = mountDashboard()
      wrapper.vm.columnFilters.priority = ['High']
      wrapper.vm.columnFilters.building_id = [9]

      await wrapper.vm.handlePickListModalOpen('Create')

      expect(listSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        building_id: 2,
        priority: ['High'],
        queue: true,
        unassociated_pick_list: true
      }))
    })

    it.each([
      [
        'createPickListJob',
        'postPicklistJob'
      ],
      [
        'updatePickListJob',
        'patchPicklistJobItem'
      ]
    ])('%s reloads the full list once pick list mode has ended', async (action, storeAction) => {
      for (const outcome of [
        'mockResolvedValue',
        'mockRejectedValue'
      ]) {
        const picklistStore = usePicklistStore()
        picklistStore.picklistJob = {
          id: 1,
          requests: []
        }
        vi.spyOn(picklistStore, storeAction)[outcome]({})
        wrapper = mountDashboard()
        wrapper.vm.showCreatePickList = true
        wrapper.vm.activePickListBuildingFilter = 2

        await wrapper.vm[action]()

        expect(wrapper.vm.isPickListMode).toBe(false)
        const lastCall = listSpy.mock.calls.at(-1)[0]
        expect(lastCall.unassociated_pick_list).toBe(false)
        expect(lastCall.building_id).toBeUndefined()
      }
    })

    it('keeps the active filters when showing the list after creating a request', async () => {
      wrapper = mountDashboard()
      wrapper.vm.columnFilters.requestor_name = 'smith'
      const reloadSpy = vi.fn()
      wrapper.vm.requestTableComponent = { reloadFromFirstPage: reloadSpy }

      wrapper.vm.showUpdatedList('request_view')

      expect(reloadSpy).toHaveBeenCalled()
    })

    it('switches list and resets paging when an import shows the batch view', async () => {
      const batchSpy = vi.spyOn(useRequestStore(), 'getRequestBatchJobList').mockResolvedValue()
      wrapper = mountDashboard()

      wrapper.vm.showUpdatedList('batch_view')

      expect(wrapper.vm.requestDisplayType).toBe('batch_view')
      expect(batchSpy).toHaveBeenCalled()
    })
  })
})
