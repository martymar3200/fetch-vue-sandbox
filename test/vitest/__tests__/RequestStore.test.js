import { createPinia, setActivePinia } from 'pinia'
import { useRequestStore } from 'src/stores/request-store'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const page = (items) => ({
  data: {
    items,
    total: items.length
  }
})

describe('request-store', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRequestStore()
    store.$api = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: { id: 1 } })
    }
  })

  it('keeps the newest list when an older response arrives last', async () => {
    let finishOlder
    store.$api.get
      .mockReturnValueOnce(new Promise(resolve => {
        finishOlder = resolve
      }))
      .mockResolvedValueOnce(page([{ id: 'newest' }]))

    const older = store.getRequestJobList({ page: 1 })
    await store.getRequestBatchJobList({ page: 1 })
    finishOlder(page([
      { id: 'older' },
      { id: 'older-2' }
    ]))
    await older

    expect(store.requestJobList).toEqual([{ id: 'newest' }])
    expect(store.requestJobListTotal).toBe(1)
  })

  it.each([
    [
      'postRequestJob',
      { barcode_value: 'A' }
    ],
    [
      'patchRequestJob',
      { id: 1 }
    ],
    [
      'postRequestBatchJob',
      {
        file: new Blob(['x']),
        requested_by_id: 1
      }
    ]
  ])('%s leaves reloading the list to the screen showing it', async (action, payload) => {
    await store[action](payload)
    expect(store.$api.get).not.toHaveBeenCalled()
  })
})
