import { createPinia, setActivePinia } from 'pinia'
import { useReportsStore } from 'src/stores/reports-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'

describe('reports-store: Move History', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useReportsStore()
    store.$api = { get: vi.fn() }
  })

  it('maps the report to the move history endpoint', () => {
    expect(store.generateReportEndpoint('Move History')).toBe('/reporting/move-history/')
  })

  it('loads the report rows and total with the chosen filters', async () => {
    const items = [
      {
        id: 1,
        barcode_value: 'AB12345',
        original_location: 'A-1',
        destination_location: 'B-2'
      }
    ]
    store.$api.get.mockResolvedValue({
      data: {
        items,
        total: 1
      }
    })

    await store.getReport({ shelving_job_id: '7' }, 'Move History')

    expect(store.$api.get).toHaveBeenCalledWith('/reporting/move-history/', {
      params: expect.objectContaining({ shelving_job_id: '7' })
    })
    expect(store.reportData).toEqual(items)
    expect(store.reportDataTotal).toBe(1)
    expect(store.reportQueryParams).toEqual({ shelving_job_id: '7' })
  })

  it('downloads the CSV from the report endpoint with the same filters', async () => {
    store.reportQueryParams = { barcode_value: 'AB12345' }
    store.$api.get.mockResolvedValue({ data: 'move_date,barcode' })
    window.URL.createObjectURL = vi.fn(() => 'blob:test')
    window.URL.revokeObjectURL = vi.fn()

    await store.downloadReport('Move History')

    expect(store.$api.get).toHaveBeenCalledWith('/reporting/move-history/download', {
      params: { barcode_value: 'AB12345' },
      responseType: 'blob'
    })
  })
})
