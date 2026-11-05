import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShippingExecute from 'src/components/Shipping/ShippingExecute.vue'
import { useShippingStore } from 'src/stores/shipping-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'

installQuasarPlugin()

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { jobId: '9' } })),
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

const mountPage = async () => {
  const wrapper = mount(ShippingExecute, {
    global: {
      stubs: {
        JobPageHeader: true,
        AuditTrail: true
      }
    }
  })
  await flushPromises()
  return wrapper
}

const scanInto = async (wrapper, index, barcode) => {
  const input = wrapper.findAllComponents({ name: 'TextInput' })[index]
  await input.vm.$emit('update:modelValue', barcode)
  await input.find('input').trigger('keydown', { key: 'Enter' })
  await flushPromises()
}

describe('ShippingExecute', () => {
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    store = useShippingStore()
    store.shippingJob = {
      id: 9,
      status: 'Running',
      bins: []
    }
    store.currentBin = null
  })

  describe('item first, then the wrong bin', () => {
    beforeEach(() => {
      store.checkItemForShipping.mockResolvedValue({
        delivery_location_id: 2,
        delivery_location: { name: 'Reading Room' }
      })
      // a bin already in the job, for another destination
      store.scanBin.mockImplementation(async () => {
        const bin = {
          id: 3,
          barcode: 'BIN-A',
          delivery_location_id: 1,
          delivery_location: { name: 'Main Desk' },
          item_count: 1
        }
        store.currentBin = bin
        return bin
      })
    })

    it('drops the wrong bin, so the next item scan does not go into it', async () => {
      const wrapper = await mountPage()

      await scanInto(wrapper, 1, 'ITEM-1')
      await scanInto(wrapper, 0, 'BIN-A')

      expect(wrapper.text()).toContain('Location Mismatch')
      expect(store.currentBin).toBeNull()
      expect(store.scanItemIntoBin).not.toHaveBeenCalled()

      // the item still waits for the right bin
      await scanInto(wrapper, 1, 'ITEM-2')
      expect(store.scanItemIntoBin).not.toHaveBeenCalled()
      expect(store.checkItemForShipping).toHaveBeenLastCalledWith('9', 'ITEM-2')
    })

    it('leaves the bin input usable', async () => {
      const wrapper = await mountPage()

      await scanInto(wrapper, 1, 'ITEM-1')
      await scanInto(wrapper, 0, 'BIN-A')

      expect(wrapper.findAllComponents({ name: 'TextInput' })[0].props('disable')).toBeFalsy()
    })
  })
})
