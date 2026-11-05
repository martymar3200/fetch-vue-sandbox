import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShippingManifest from 'src/components/Shipping/ShippingManifest.vue'
import ShippingManifestBatchSheet from 'src/components/Shipping/ShippingManifestBatchSheet.vue'
import { useShippingStore } from 'src/stores/shipping-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'

installQuasarPlugin()

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { jobId: '5' } }))
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

// One bin with a tray item and a non-tray item, as the API returns it
const manifest = {
  id: 5,
  completed_dt: null,
  bins: [
    {
      id: 1,
      barcode: 'BIN-1',
      delivery_location: {
        id: 2,
        name: 'Reading Room'
      },
      items: [
        {
          id: 10,
          barcode: { value: 'TRAY-ITEM' }
        }
      ],
      non_tray_items: [
        {
          id: 20,
          barcode: { value: 'NON-TRAY-ITEM' }
        }
      ],
      item_count: 2
    }
  ]
}

const provide = { 'format-date-time': () => ({ dateTime: '' }) }

describe('Shipping manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists and counts non-tray items on screen', async () => {
    useShippingStore().getManifest.mockResolvedValue(manifest)
    const wrapper = mount(ShippingManifest, {
      global: {
        provide,
        stubs: { ShippingManifestBatchSheet: true }
      }
    })
    await flushPromises()

    const text = wrapper.find('.manifest-content').text()
    expect(text).toContain('TRAY-ITEM')
    expect(text).toContain('NON-TRAY-ITEM')
    expect(text).toContain('Total Items: 2')
    expect(wrapper.find('tbody td.text-right').text()).toBe('2')
  })

  it('lists and counts non-tray items on the printed sheet', () => {
    const wrapper = mount(ShippingManifestBatchSheet, {
      props: { manifestData: manifest },
      global: {
        provide,
        stubs: { PrintTemplate: { template: '<div><slot name="print-html" /></div>' } }
      }
    })

    const text = wrapper.text()
    expect(text).toContain('NON-TRAY-ITEM')
    expect(text).toContain('Total Items: 2')
  })
})
