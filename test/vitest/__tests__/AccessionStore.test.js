import { createPinia, setActivePinia } from 'pinia'
import { useAccessionStore } from 'src/stores/accession-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import { createApp } from 'vue'

// Real store actions (the global setup stubs them) with a mocked $api
const mockApi = {
  get: vi.fn(),
  post: vi.fn()
}

describe('accession-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    pinia.use(() => ({ $api: mockApi }))
    // pinia only applies plugins once installed in an app
    createApp({}).use(pinia)
    setActivePinia(pinia)
  })

  describe('postAccessionTrayItem', () => {
    it('adds the new item to the tray and job without reloading the job', async () => {
      const store = useAccessionStore()
      const existingItem = {
        id: 1,
        tray_id: 10
      }
      store.accessionJob = {
        id: 5,
        workflow_id: 7,
        trays: [{ id: 10 }],
        items: [existingItem]
      }
      store.originalAccessionJob = { ...store.accessionJob }
      store.accessionContainer = {
        id: 10,
        items: [existingItem]
      }

      const newItem = {
        id: 2,
        tray_id: 10
      }
      mockApi.post.mockResolvedValue({ data: newItem })

      await store.postAccessionTrayItem({ tray_id: 10 })

      expect(store.accessionContainer.items).toEqual([
        existingItem,
        newItem
      ])
      expect(store.accessionJob.items).toEqual([
        existingItem,
        newItem
      ])
      expect(store.originalAccessionJob.items).toEqual([
        existingItem,
        newItem
      ])
      expect(mockApi.get).not.toHaveBeenCalled()
    })

    it('handles a job with no items list yet', async () => {
      const store = useAccessionStore()
      store.accessionJob = {
        id: 5,
        workflow_id: 7,
        trays: [{ id: 10 }]
      }
      store.originalAccessionJob = null
      store.accessionContainer = {
        id: 10,
        items: []
      }

      const newItem = {
        id: 2,
        tray_id: 10
      }
      mockApi.post.mockResolvedValue({ data: newItem })

      await store.postAccessionTrayItem({ tray_id: 10 })

      expect(store.accessionJob.items).toEqual([newItem])
    })

    it('leaves state unchanged when saving fails', async () => {
      const store = useAccessionStore()
      store.accessionJob = {
        id: 5,
        workflow_id: 7,
        trays: [{ id: 10 }],
        items: []
      }
      store.accessionContainer = {
        id: 10,
        items: []
      }
      mockApi.post.mockRejectedValue(new Error('save failed'))

      await expect(store.postAccessionTrayItem({ tray_id: 10 })).rejects.toThrow('save failed')

      expect(store.accessionContainer.items).toEqual([])
      expect(store.accessionJob.items).toEqual([])
    })
  })
})
