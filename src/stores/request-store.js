import { defineStore } from 'pinia'
import inventoryServiceApi from '@/http/InventoryService.js'

// the request and batch lists share one table: only the newest load may fill it, however the responses arrive
let latestListLoad = 0

export const useRequestStore = defineStore('request-store', {
  state: () => ({
    requestJobListTotal: 0,
    requestJobList: [],
    requestJob: {
      id: null,
      accession_dt: null,
      arrival_dt: null,
      barcode: {
        value: null
      },
      building: {
        name: ''
      },
      create_dt: null,
      condition: null,
      delivery_location: null,
      dimensions: null,
      external_request_id: null,
      item_location: null,
      media_type: {
        name: ''
      },
      owner: {
        name: ''
      },
      priority: null,
      requestor_name: null,
      status: null,
      size_class: {
        name: ''
      },
      type: null,
      withdrawal_dt: null
    },
    requestBatchJob: {
      id: null,
      import_source: null,
      request_count: null,
      status: null,
      uploaded_by: null,
      import_dt: null,
      items: []
    }
  }),
  actions: {
    resetRequestStore () {
      this.$reset()
    },
    resetRequestJob () {
      this.requestJob = {
        id: null,
        accession_dt: null,
        arrival_dt: null,
        barcode: {
          value: null
        },
        building: {
          name: ''
        },
        create_dt: null,
        condition: null,
        delivery_location: null,
        dimensions: null,
        external_request_id: null,
        item_location: null,
        media_type: {
          name: ''
        },
        owner: {
          name: ''
        },
        priority: null,
        requestor_name: null,
        status: null,
        size_class: {
          name: ''
        },
        type: null,
        withdrawal_dt: null
      }
    },
    async getRequestJobList (paramsObj) {
      const listLoad = ++latestListLoad
      try {
        const res = await this.$api.get(inventoryServiceApi.requests, {
          params: {
            size: this.apiPageSizeDefault,
            ...paramsObj
          }
        })
        if (listLoad !== latestListLoad) {
          return
        }
        this.requestJobList = res.data.items

        // keep track of response total for pagination
        this.requestJobListTotal = res.data.total
      } catch (error) {
        throw error
      }
    },
    async getRequestJob (id) {
      try {
        const res = await this.$api.get(`${inventoryServiceApi.requests}${id}`)
        this.requestJob = res.data
      } catch (error) {
        throw error
      }
    },
    async postRequestJob (payload) {
      try {
        await this.$api.post(inventoryServiceApi.requests, payload)
      } catch (error) {
        throw error
      }
    },
    async patchRequestJob (payload) {
      try {
        const res = await this.$api.patch(`${inventoryServiceApi.requests}${payload.id}`, payload)
        this.requestJob = res.data
      } catch (error) {
        throw error
      }
    },
    async deleteRequestJob (id) {
      try {
        await this.$api.delete(`${inventoryServiceApi.requests}${id}`)
        this.resetRequestJob()
      } catch (error) {
        throw error
      }
    },
    async getRequestBatchJobList (qParams) {
      const listLoad = ++latestListLoad
      try {
        const res = await this.$api.get(inventoryServiceApi.batchUpload, {
          params: {
            ...qParams,
            batch_upload_type: 'request'
          }
        })
        if (listLoad !== latestListLoad) {
          return
        }
        this.requestJobList = res.data.items

        // keep track of response total for pagination
        this.requestJobListTotal = res.data.total
      } catch (error) {
        throw error
      }
    },
    async getRequestBatchJob (id) {
      try {
        const res = await this.$api.get(`${inventoryServiceApi.batchUpload}${id}`)
        this.requestBatchJob  = res.data
      } catch (error) {
        throw error
      }
    },
    async postRequestBatchJob (payload) {
      try {
        // create a formData Object and assign the file to the formData to be passed to api as 'multipart/form-data' content
        let formData = new FormData()
        formData.append('file', payload.file)
        formData.append('requested_by_id', payload.requested_by_id)
        await this.$api.post(`${inventoryServiceApi.batchUpload}request`, formData)
      } catch (error) {
        throw error
      }
    }
  }
})
