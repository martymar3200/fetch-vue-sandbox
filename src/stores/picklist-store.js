import { defineStore } from 'pinia'
import inventoryServiceApi from '@/http/InventoryService.js'
import { useOfflineSync } from '@/composables/useOfflineSync.js'
import { useIndexDbHandler } from '@/composables/useIndexDbHandler.js'
export const usePicklistStore = defineStore('picklist-store', {
  state: () => ({
    picklistJobListTotal: 0,
    picklistJobList: [],
    picklistJob: {
      id: null,
      building: null,
      user: null,
      assigned_user_id: null,
      create_dt: null,
      status: null,
      requests: []
    },
    originalPicklistJob: null,
    picklistItem: {
      id: null,
      barcode: {
        value: null
      }
    }
  }),
  getters: {
    picklistItems: (state) => {
      let items = []
      if (state.picklistJob.requests.length > 0) {
        items = state.picklistJob.requests.map(rq => {
          return {
            ...rq,
            status: rq.item ? rq.item.status : rq.non_tray_item.status
          }
        })
      }
      return items
    },
    allItemsRetrieved: (state) => {
      if (state.picklistJob.id && state.picklistJob.status !== 'Created') {
        // when a picklist job is active we can keep track of if all requested items have been pulled/retrieved using status
        return state.picklistItems.length == 0 || state.picklistItems.some(itm => itm.status == 'PickList') ? false : true
      } else {
        return true
      }
    }
  },
  actions: {
    resetPicklistStore () {
      this.$reset()
    },
    async getPicklistJobList (qParams) {
      try {
        const res = await this.$api.get(inventoryServiceApi.picklists, {
          params: {
            size: this.apiPageSizeDefault,
            ...qParams
          }
        })
        this.picklistJobList = res.data.items

        // keep track of response total for pagination
        this.picklistJobListTotal = res.data.total
      } catch (error) {
        throw error
      }
    },
    async getPicklistJob (id) {
      try {
        const res = await this.$api.get(`${inventoryServiceApi.picklists}${id}`)
        this.picklistJob = res.data
        this.originalPicklistJob = { ...this.picklistJob }
      } catch (error) {
        throw error
      }
    },
    async postPicklistJob (payload) {
      try {
        const res = await this.$api.post(inventoryServiceApi.picklists, payload)
        this.picklistJob = res.data
        this.originalPicklistJob = { ...this.picklistJob }
      } catch (error) {
        throw error
      }
    },
    async patchPicklistJob (payload) {
      const { offlineAwareRequest } = useOfflineSync()
      const { addDataToIndexDb } = useIndexDbHandler()
      try {
        const res = await offlineAwareRequest({
          method: 'PATCH',
          url: `${inventoryServiceApi.picklists}${payload.id}`,
          payload,
          optimisticUpdate: () => {
            if (this.picklistJob && payload.status) {
              this.picklistJob.status = payload.status
              this.originalPicklistJob.status = payload.status
            }
          },
          updateSnapshot: async () => {
            await addDataToIndexDb('picklistStore', 'picklistJob', JSON.parse(JSON.stringify(this.picklistJob)))
            await addDataToIndexDb('picklistStore', 'originalPicklistJob', JSON.parse(JSON.stringify(this.originalPicklistJob)))
          }
        })
        if (res.fromServer) {
          this.picklistJob = res.data
          this.originalPicklistJob = { ...this.picklistJob }
        }
      } catch (error) {
        throw error
      }
    },
    async deletePicklistJob (jobId) {
      try {
        await this.$api.delete(`${inventoryServiceApi.picklists}${jobId}`)
        this.resetPicklistStore()
      } catch (error) {
        throw error
      }
    },
    resetPicklistItem () {
      this.picklistItem = {
        id: null,
        barcode: {
          value: null
        }
      }
    },
    async getPicklistJobItem (itemId) {
      //find the item with the matching barcode_value and set the data as the picklistJobItem
      this.picklistItem = this.picklistJob.requests.find(picklistRequest => picklistRequest?.item?.barcode.value == itemId || picklistRequest.non_tray_item?.barcode.value == itemId)
    },
    async patchPicklistJobItem (payload) {
      try {
        // used to add request items to a picklist
        const res = await this.$api.patch(`${inventoryServiceApi.picklists}${payload.id}/add_request`, payload)
        this.picklistJob = res.data
        this.originalPicklistJob = { ...this.picklistJob }
      } catch (error) {
        throw error
      }
    },
    async patchPicklistJobItemScanned (payload) {
      const { offlineAwareRequest } = useOfflineSync()
      const { addDataToIndexDb } = useIndexDbHandler()
      try {
        const res = await offlineAwareRequest({
          method: 'PATCH',
          url: `${inventoryServiceApi.picklists}${payload.id}/update_request/${payload.request_id}`,
          payload,
          optimisticUpdate: () => {
            const index = this.picklistJob.requests.findIndex(request => request.id == payload.request_id)
            if (index !== -1) {
              const requestObj = this.picklistJob.requests[index]
              if (requestObj.item) {
                requestObj.item.status = payload.status
              } else if (requestObj.non_tray_item) {
                requestObj.non_tray_item.status = payload.status
              }
              requestObj.fulfilled = true
              // Move the item to the bottom of the list
              this.picklistJob.requests.splice(index, 1)
              this.picklistJob.requests.push(requestObj)
            }
            this.originalPicklistJob = { ...this.picklistJob }
          },
          updateSnapshot: async () => {
            await addDataToIndexDb('picklistStore', 'picklistJob', JSON.parse(JSON.stringify(this.picklistJob)))
            await addDataToIndexDb('picklistStore', 'originalPicklistJob', JSON.parse(JSON.stringify(this.originalPicklistJob)))
          }
        })
        if (res.fromServer) {
          await this.applyPicklistScanResult(res.data)
        }
      } catch (error) {
        throw error
      }
    },
    // A scan only returns each request's state, which also carries colleagues' scans on a shared job.
    // Requests keep their walking order from the last full load, with retrieved ones after the rest.
    async applyPicklistScanResult (result) {
      const latest = new Map(result.requests.map(request => [
        request.id,
        request
      ]))
      const requests = this.picklistJob.requests

      if (requests.length !== latest.size || requests.some(request => !latest.has(request.id))) {
        // a colleague added or removed an item, so only a full load has its details and place in the order
        try {
          await this.getPicklistJob(this.picklistJob.id)
        } catch (error) {
          // the scan itself saved, and the next scan tries this again
          console.warn('Failed to reload pick list after scan', error)
        }
        return
      }

      requests.forEach(request => {
        const { fulfilled, item_status: itemStatus } = latest.get(request.id)
        request.fulfilled = fulfilled
        if (request.item) {
          request.item.status = itemStatus
        } else if (request.non_tray_item) {
          request.non_tray_item.status = itemStatus
        }
      })
      this.picklistJob.status = result.status
      this.picklistJob.requests = [
        ...requests.filter(request => !request.fulfilled),
        ...requests.filter(request => request.fulfilled)
      ]
      this.originalPicklistJob = { ...this.picklistJob }
    },
    async deletePicklistJobItem (itemId) {
      const { offlineAwareRequest } = useOfflineSync()
      const { addDataToIndexDb } = useIndexDbHandler()
      try {
        const res = await offlineAwareRequest({
          method: 'DELETE',
          url: `${inventoryServiceApi.picklists}${this.picklistJob.id}/remove_request/${itemId}`,
          optimisticUpdate: () => {
            const index = this.picklistJob.requests.findIndex(request => request.id == itemId)
            if (index !== -1) {
              this.picklistJob.requests.splice(index, 1)
            }
            this.originalPicklistJob = { ...this.picklistJob }
          },
          updateSnapshot: async () => {
            await addDataToIndexDb('picklistStore', 'picklistJob', JSON.parse(JSON.stringify(this.picklistJob)))
            await addDataToIndexDb('picklistStore', 'originalPicklistJob', JSON.parse(JSON.stringify(this.originalPicklistJob)))
          }
        })
        if (res.fromServer) {
          this.picklistJob = res.data
          this.originalPicklistJob = { ...this.picklistJob }
        }
      } catch (error) {
        throw error
      }
    }
  }
})
