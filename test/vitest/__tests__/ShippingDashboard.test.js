import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShippingDashboard from 'src/components/Shipping/ShippingDashboard.vue'
import { useShippingStore } from 'src/stores/shipping-store'
import { useOptionStore } from 'src/stores/option-store'
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

  describe('job list params', () => {
    const filterTableStub = {
      name: 'EssentialTable',
      props: ['tableColumns'],
      emits: ['update-pagination'],
      template: `<div>
        <slot name="heading-row" />
        <table><thead><slot name="header-filter-row" :cols="tableColumns" /></thead></table>
      </div>`
    }

    const mountWithFilters = async () => {
      const wrapper = mount(ShippingDashboard, {
        global: {
          stubs: {
            EssentialTable: filterTableStub,
            ShippingClearBinModal: true
          }
        }
      })
      await flushPromises()
      await wrapper.findAll('button').find(b => b.text().includes('Show Filters') || b.html().includes('filter_alt')).trigger('click')
      return wrapper
    }

    const lastParams = () => useShippingStore().getShippingJobList.mock.lastCall[0]

    it('lists open jobs, Paused included, with only params the API reads', async () => {
      await mountWithFilters()

      expect(lastParams()).toEqual({
        page: 1,
        size: 25,
        status: [
          'Created',
          'Assigned',
          'Running',
          'Paused'
        ]
      })
    })

    it('searches by job number with the param the API reads', async () => {
      const wrapper = await mountWithFilters()

      await wrapper.findComponent({ name: 'QInput' }).vm.$emit('update:modelValue', '123')
      await flushPromises()

      expect(lastParams().workflow_id).toBe('123')
      expect(lastParams()).not.toHaveProperty('id')
    })

    it('filters by the full names the API matches', async () => {
      useOptionStore().users = [{ name: 'Pat Lee' }]
      const wrapper = await mountWithFilters()
      const userSelect = wrapper.findAllComponents({ name: 'QSelect' })
        .find(select => select.props('options')?.[0]?.value === 'Pat Lee')

      await userSelect.vm.$emit('update:modelValue', ['Pat Lee'])
      await flushPromises()

      expect(lastParams().assigned_user).toEqual(['Pat Lee'])
    })

    it('offers Paused in the status filter', async () => {
      const wrapper = await mountWithFilters()
      const statusSelect = wrapper.findAllComponents({ name: 'QSelect' })
        .find(select => select.props('options')?.includes('Running'))

      expect(statusSelect.props('options')).toContain('Paused')
    })

    it('sends the table sort and keeps it when a filter changes', async () => {
      const wrapper = await mountWithFilters()
      const table = wrapper.findComponent({ name: 'EssentialTable' })

      await table.vm.$emit('update-pagination', {
        page: 2,
        rowsPerPage: 50,
        size: 50,
        sortBy: 'id',
        descending: true,
        rowsNumber: 80,
        sort_by: 'id',
        sort_order: 'desc'
      })
      await flushPromises()
      expect(lastParams()).toMatchObject({
        page: 2,
        size: 50,
        sort_by: 'id',
        sort_order: 'desc'
      })
      expect(lastParams()).not.toHaveProperty('rowsNumber')
      expect(lastParams()).not.toHaveProperty('sortBy')

      await wrapper.findComponent({ name: 'QInput' }).vm.$emit('update:modelValue', '9')
      await flushPromises()
      expect(lastParams()).toMatchObject({
        page: 1,
        sort_by: 'id',
        sort_order: 'desc',
        workflow_id: '9'
      })
    })
  })

  it('shows the server message when the list can not load', async () => {
    const { notify } = await import('@/utils/notify')
    useShippingStore().getShippingJobList.mockRejectedValue({
      response: { data: { detail: 'Shipping module is disabled' } }
    })

    mount(ShippingDashboard, {
      global: {
        stubs: {
          EssentialTable: true,
          ShippingClearBinModal: true
        }
      }
    })
    await flushPromises()

    expect(notify).toHaveBeenCalledWith({
      type: 'negative',
      message: 'Shipping module is disabled'
    })
  })

})
