import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShippingDashboard from 'src/components/Shipping/ShippingDashboard.vue'
import { vi, describe, it, beforeEach, expect } from 'vitest'

installQuasarPlugin()

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push }))
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

// Renders one cell of the actions column with a real row, the way EssentialTable does
const actionsCellStub = (row) => ({
  name: 'EssentialTable',
  props: ['tableColumns'],
  setup () {
    return {
      cellProps: {
        row,
        col: { name: 'actions' },
        value: null
      }
    }
  },
  template: `<div>
    <slot name="table-td" :props="cellProps" col-name="actions" :value="null" />
  </div>`
})

const mountWithRow = async (row) => {
  const wrapper = mount(ShippingDashboard, {
    global: {
      stubs: {
        EssentialTable: actionsCellStub(row),
        ShippingClearBinModal: true,
        // show the menu's items without opening it
        QMenu: { template: '<div><slot /></div>' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

const manifestItem = (wrapper) => wrapper.findAllComponents({ name: 'QItem' })
  .find(item => item.text().includes('View Manifest'))

describe('ShippingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('row actions menu', () => {
    it('opens the manifest of a completed job', async () => {
      const wrapper = await mountWithRow({
        id: 42,
        status: 'Completed'
      })

      const item = manifestItem(wrapper)
      expect(item.props('disable')).toBe(false)

      await item.trigger('click')
      expect(push).toHaveBeenCalledWith({
        name: 'shipping-manifest',
        params: { jobId: 42 }
      })
    })

    it('keeps View Manifest disabled for a job that is not completed', async () => {
      const wrapper = await mountWithRow({
        id: 7,
        status: 'Running'
      })

      expect(manifestItem(wrapper).props('disable')).toBe(true)
    })
  })
})
