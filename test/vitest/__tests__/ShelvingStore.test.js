import { createPinia, setActivePinia } from 'pinia'
import { useShelvingStore } from 'src/stores/shelving-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'

const offlineAwareRequest = vi.fn()

vi.mock('@/composables/useOfflineSync.js', () => ({
  useOfflineSync: () => ({ offlineAwareRequest })
}))

vi.mock('@/composables/useIndexDbHandler.js', () => ({
  useIndexDbHandler: () => ({ addDataToIndexDb: vi.fn() })
}))

describe('shelving-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('postShelvingJobContainer', () => {
    const payload = {
      job_id: 5,
      container_barcode_value: 'AB12345',
      shelf_barcode_value: '123456',
      shelf_position_number: 2
    }

    it('returns the server result when the move is saved', async () => {
      const store = useShelvingStore()
      const saved = {
        fromServer: true,
        data: {
          id: 10,
          container_type: { type: 'Tray' },
          next_available_position: 3
        }
      }
      offlineAwareRequest.mockResolvedValue(saved)

      const res = await store.postShelvingJobContainer(payload)

      expect(res).toBe(saved)
      expect(store.shelvingJob.nextAvailablePosition).toBe(3)
    })

    it('returns fromServer false when the move is queued offline', async () => {
      const store = useShelvingStore()
      offlineAwareRequest.mockResolvedValue({ fromServer: false })

      const res = await store.postShelvingJobContainer(payload)

      expect(res).toEqual({ fromServer: false })
    })

    it('still throws when the server rejects the move', async () => {
      const store = useShelvingStore()
      const rejection = new Error('Shelf Position is already occupied')
      offlineAwareRequest.mockRejectedValue(rejection)

      await expect(store.postShelvingJobContainer(payload)).rejects.toBe(rejection)
    })
  })
})
