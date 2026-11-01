import { createPinia, setActivePinia } from 'pinia'
import { usePicklistStore } from 'src/stores/picklist-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import { createApp } from 'vue'

const offlineAwareRequest = vi.fn()

vi.mock('@/composables/useOfflineSync.js', () => ({
  useOfflineSync: () => ({ offlineAwareRequest })
}))

vi.mock('@/composables/useIndexDbHandler.js', () => ({
  useIndexDbHandler: () => ({ addDataToIndexDb: vi.fn() })
}))

// Real store actions (the global setup stubs them) with a mocked $api
const mockApi = { get: vi.fn() }

const trayRequest = (id, status = 'PickList', fulfilled = false) => ({
  id,
  fulfilled,
  item: {
    status,
    barcode: { value: `B${id}` },
    tray: { id: id * 10 }
  }
})

const nonTrayRequest = (id, status = 'PickList', fulfilled = false) => ({
  id,
  fulfilled,
  non_tray_item: {
    status,
    barcode: { value: `B${id}` }
  }
})

const scanResult = (rows, status = 'Running') => ({
  fromServer: true,
  data: {
    id: 5,
    status,
    requests: rows.map(([
      id,
      fulfilled,
      itemStatus
    ]) => ({
      id,
      fulfilled,
      item_status: itemStatus
    }))
  }
})

const scan = (store, requestId) => store.patchPicklistJobItemScanned({
  id: 5,
  request_id: requestId,
  status: 'Out'
})

const order = store => store.picklistJob.requests.map(request => request.id)

describe('picklist-store', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    pinia.use(() => ({ $api: mockApi }))
    // pinia only applies plugins once installed in an app
    createApp({}).use(pinia)
    setActivePinia(pinia)
    store = usePicklistStore()
    // requests 1 to 4 are in walking order, as the server sorted them
    store.picklistJob = {
      id: 5,
      status: 'Running',
      building: { name: 'Main' },
      requests: [
        trayRequest(1),
        nonTrayRequest(2),
        trayRequest(3),
        trayRequest(4)
      ]
    }
    store.originalPicklistJob = { ...store.picklistJob }
  })

  describe('patchPicklistJobItemScanned', () => {
    it('keeps walking order and moves the scanned item after the rest', async () => {
      offlineAwareRequest.mockResolvedValue(scanResult([
        [
          1,
          false,
          'PickList'
        ],
        [
          2,
          true,
          'Out'
        ],
        [
          3,
          false,
          'PickList'
        ],
        [
          4,
          false,
          'PickList'
        ]
      ]))

      await scan(store, 2)

      expect(order(store)).toEqual([
        1,
        3,
        4,
        2
      ])
      expect(store.picklistItems[3].status).toBe('Out')
      expect(mockApi.get).not.toHaveBeenCalled()
    })

    it('offers the next item in walking order after out of order scans', async () => {
      offlineAwareRequest.mockResolvedValue(scanResult([
        [
          1,
          true,
          'Out'
        ],
        [
          2,
          false,
          'PickList'
        ],
        [
          3,
          true,
          'Out'
        ],
        [
          4,
          false,
          'PickList'
        ]
      ]))

      await scan(store, 3)

      expect(store.picklistItems.find(item => item.status === 'PickList').id).toBe(2)
      expect(order(store).slice(0, 2)).toEqual([
        2,
        4
      ])
    })

    it('shows a colleague\'s scans and completes the progress', async () => {
      offlineAwareRequest.mockResolvedValue(scanResult([
        [
          1,
          true,
          'Out'
        ],
        [
          2,
          true,
          'Out'
        ],
        [
          3,
          true,
          'Out'
        ],
        [
          4,
          true,
          'Out'
        ]
      ]))

      await scan(store, 1)

      expect(store.picklistItems.every(item => item.status === 'Out')).toBe(true)
      expect(store.allItemsRetrieved).toBe(true)
    })

    it('shows a colleague pausing the job', async () => {
      offlineAwareRequest.mockResolvedValue(scanResult([
        [
          1,
          true,
          'Out'
        ],
        [
          2,
          false,
          'PickList'
        ],
        [
          3,
          false,
          'PickList'
        ],
        [
          4,
          false,
          'PickList'
        ]
      ], 'Paused'))

      await scan(store, 1)

      expect(store.picklistJob.status).toBe('Paused')
    })

    it('keeps each item\'s details', async () => {
      offlineAwareRequest.mockResolvedValue(scanResult([
        [
          1,
          true,
          'Out'
        ],
        [
          2,
          false,
          'PickList'
        ],
        [
          3,
          false,
          'PickList'
        ],
        [
          4,
          false,
          'PickList'
        ]
      ]))

      await scan(store, 1)

      const scanned = store.picklistJob.requests.find(request => request.id === 1)
      expect(scanned.item.barcode.value).toBe('B1')
      expect(scanned.item.tray.id).toBe(10)
      expect(store.picklistJob.building.name).toBe('Main')
    })

    it.each([
      [
        'removed',
        [
          [
            1,
            true,
            'Out'
          ],
          [
            2,
            false,
            'PickList'
          ],
          [
            3,
            false,
            'PickList'
          ]
        ]
      ],
      [
        'added',
        [
          [
            1,
            true,
            'Out'
          ],
          [
            2,
            false,
            'PickList'
          ],
          [
            3,
            false,
            'PickList'
          ],
          [
            4,
            false,
            'PickList'
          ],
          [
            9,
            false,
            'PickList'
          ]
        ]
      ],
      [
        'swapped',
        [
          [
            1,
            true,
            'Out'
          ],
          [
            2,
            false,
            'PickList'
          ],
          [
            3,
            false,
            'PickList'
          ],
          [
            9,
            false,
            'PickList'
          ]
        ]
      ]
    ])('reloads the full job when a colleague %s an item', async (_change, rows) => {
      offlineAwareRequest.mockResolvedValue(scanResult(rows))
      mockApi.get.mockResolvedValue({
        data: {
          id: 5,
          status: 'Running',
          requests: [
            trayRequest(2),
            trayRequest(3),
            trayRequest(1, 'Out', true)
          ]
        }
      })

      await scan(store, 1)

      expect(mockApi.get).toHaveBeenCalledTimes(1)
      expect(order(store)).toEqual([
        2,
        3,
        1
      ])
    })

    it('does not report a saved scan as failed when the reload fails', async () => {
      offlineAwareRequest.mockResolvedValue(scanResult([
        [
          1,
          true,
          'Out'
        ]
      ]))
      mockApi.get.mockRejectedValue(new Error('Network Error'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(scan(store, 1)).resolves.toBeUndefined()

      warn.mockRestore()
    })

    it('still marks an offline scan as retrieved locally', async () => {
      offlineAwareRequest.mockImplementation(async ({ optimisticUpdate }) => {
        optimisticUpdate()
        return { fromServer: false }
      })

      await scan(store, 2)

      expect(order(store)).toEqual([
        1,
        3,
        4,
        2
      ])
      expect(store.picklistJob.requests[3].fulfilled).toBe(true)
      expect(store.picklistItems[3].status).toBe('Out')
    })
  })
})
