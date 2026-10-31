import { describe, expect, it } from 'vitest'
import { api } from 'src/boot/axios'

const serialize = (params) => api.defaults.paramsSerializer(params)

describe('axios paramsSerializer', () => {
  it('repeats the key for array values', () => {
    expect(serialize({
      owner_id: [
        1,
        2
      ]
    })).toBe('owner_id=1&owner_id=2')
  })

  it('drops null values', () => {
    expect(serialize({
      page: 1,
      sort_by: null
    })).toBe('page=1')
  })

  it('keeps reserved characters inside the value', () => {
    expect(serialize({ delivery_location: ['Reading & Annex'] })).toBe('delivery_location=Reading%20%26%20Annex')
    expect(serialize({ barcode_value: 'A+B#1%' })).toBe('barcode_value=A%2BB%231%25')
  })

  it('keeps a date offset intact', () => {
    expect(serialize({ from_dt: '2026-10-31T00:00:00+00:00' })).toBe('from_dt=2026-10-31T00%3A00%3A00%2B00%3A00')
  })
})
