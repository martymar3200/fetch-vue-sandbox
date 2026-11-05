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

  describe('location and bin views', () => {
    const twoBins = {
      id: 5,
      completed_dt: null,
      bins: [
        {
          id: 1,
          barcode: 'BIN-B',
          delivery_location_id: 2,
          delivery_location: {
            id: 2,
            name: 'Reading Room'
          },
          items: [
            {
              id: 10,
              barcode: { value: 'ITEM-RR' }
            }
          ],
          non_tray_items: [],
          item_count: 1
        },
        {
          id: 3,
          barcode: 'BIN-A',
          delivery_location_id: 4,
          delivery_location: {
            id: 4,
            name: 'Main Desk'
          },
          items: [
            {
              id: 11,
              barcode: { value: 'ITEM-MD' }
            }
          ],
          non_tray_items: [],
          item_count: 1
        }
      ]
    }

    const mountManifest = async () => {
      useShippingStore().getManifest.mockResolvedValue(twoBins)
      const wrapper = mount(ShippingManifest, {
        global: {
          provide,
          stubs: { ShippingManifestBatchSheet: true }
        }
      })
      await flushPromises()
      return wrapper
    }

    const pick = async (wrapper, scopeLabel, option) => {
      await wrapper.findAll('button').find(b => b.text() === scopeLabel).trigger('click')
      const select = wrapper.findComponent({ name: 'QSelect' })
      await select.vm.$emit('update:modelValue', option)
      await flushPromises()
      return select
    }

    it('shows one location without fetching again, and still offers every location', async () => {
      const wrapper = await mountManifest()

      const select = await pick(wrapper, 'By Location', twoBins.bins[1].delivery_location)

      const shown = wrapper.find('.manifest-content').text()
      expect(shown).toContain('ITEM-MD')
      expect(shown).not.toContain('ITEM-RR')
      expect(select.props('options').map(o => o.name)).toEqual([
        'Main Desk',
        'Reading Room'
      ])
      expect(useShippingStore().getManifest).toHaveBeenCalledTimes(1)
    })

    it('shows one bin without fetching again', async () => {
      const wrapper = await mountManifest()

      const select = await pick(wrapper, 'By Bin', twoBins.bins[0])

      const shown = wrapper.find('.manifest-content').text()
      expect(shown).toContain('ITEM-RR')
      expect(shown).not.toContain('ITEM-MD')
      expect(shown).toContain('Total Items: 1')
      expect(select.props('options').map(o => o.barcode)).toEqual([
        'BIN-A',
        'BIN-B'
      ])
      expect(useShippingStore().getManifest).toHaveBeenCalledTimes(1)
    })
  })
})
