import { createPinia, setActivePinia } from 'pinia'
import { useShippingStore } from 'src/stores/shipping-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import { createApp } from 'vue'

// Real store actions (the global setup stubs them) with a mocked $api
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn()
}

const bin = {
  id: 3,
  barcode: 'BIN-1',
  items: [],
  non_tray_items: [],
  item_count: 0
}

describe('shipping store', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    pinia.use(() => ({ $api: mockApi }))
    // pinia only applies plugins once installed in an app
    createApp({}).use(pinia)
    setActivePinia(pinia)
    store = useShippingStore()
    mockApi.post.mockResolvedValue({ data: bin })
    mockApi.get.mockResolvedValue({
      data: {
        id: 9,
        status: 'Running',
        assigned_user: { first_name: 'Pat' },
        bins: [bin]
      }
    })
  })

  describe('job status after a scan', () => {
    it.each([
      'scanBin',
      'scanItemIntoBin'
    ])('%s shows the status the server gave a Created job', async (action) => {
      store.shippingJob = {
        id: 9,
        status: 'Created',
        bins: []
      }

      await (action === 'scanBin' ? store.scanBin(9, 'BIN-1') : store.scanItemIntoBin(9, 3, 'ITEM-1'))

      expect(mockApi.get).toHaveBeenCalledWith('/shipping-jobs/9')
      expect(store.shippingJob.status).toBe('Running')
      expect(store.shippingJob.assigned_user.first_name).toBe('Pat')
    })

    it('does not reload a job that is already Running', async () => {
      store.shippingJob = {
        id: 9,
        status: 'Running',
        bins: []
      }

      await store.scanItemIntoBin(9, 3, 'ITEM-1')

      expect(mockApi.get).not.toHaveBeenCalled()
    })

    it('does not set a status the server has not confirmed', async () => {
      store.shippingJob = {
        id: 9,
        status: 'Created',
        bins: []
      }
      mockApi.get.mockRejectedValue(new Error('offline'))

      await store.scanItemIntoBin(9, 3, 'ITEM-1')

      expect(store.shippingJob.status).toBe('Created')
    })
  })

  describe('removing an item', () => {
    it('shows the bin the server returns, count included', async () => {
      const fullBin = {
        ...bin,
        items: [
          { id: 1 },
          { id: 2 }
        ],
        item_count: 2,
        delivery_location_id: 4
      }
      const afterRemove = {
        ...bin,
        items: [{ id: 2 }],
        item_count: 1,
        delivery_location_id: 4
      }
      store.shippingJob = {
        id: 9,
        status: 'Running',
        bins: [fullBin]
      }
      store.currentBin = fullBin
      mockApi.delete.mockResolvedValue({ data: afterRemove })

      await store.removeItemFromBin(9, 3, 1, 'item')

      expect(store.shippingJob.bins[0].item_count).toBe(1)
      expect(store.shippingJob.bins[0].items).toEqual([{ id: 2 }])
      expect(store.currentBin.item_count).toBe(1)
    })

    it('clears the destination of a bin the server emptied', async () => {
      store.shippingJob = {
        id: 9,
        status: 'Running',
        bins: [
          {
            ...bin,
            items: [{ id: 1 }],
            item_count: 1,
            delivery_location_id: 4
          }
        ]
      }
      mockApi.delete.mockResolvedValue({
        data: {
          ...bin,
          delivery_location_id: null
        }
      })

      await store.removeItemFromBin(9, 3, 1, 'item')

      expect(store.shippingJob.bins[0].item_count).toBe(0)
      expect(store.shippingJob.bins[0].delivery_location_id).toBeNull()
    })
  })
})
