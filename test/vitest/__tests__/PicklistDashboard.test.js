import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { QSelect } from 'quasar'
import PicklistDashboard from 'src/components/Picklist/PicklistDashboard.vue'
import { useOptionStore } from 'src/stores/option-store'
import { usePicklistStore } from 'src/stores/picklist-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'

installQuasarPlugin()

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

const reloadFromFirstPage = vi.fn()

const EssentialTableStub = {
  name: 'EssentialTable',
  props: ['tableColumns'],
  emits: ['update-pagination'],
  methods: { reloadFromFirstPage },
  template: `<div>
    <slot name="heading-row" />
    <table><thead><slot name="header-filter-row" :cols="tableColumns" /></thead></table>
  </div>`
}

const mountPage = async () => {
  const wrapper = mount(PicklistDashboard, {
    global: {
      provide: { 'format-date-time': () => ({ date: '' }) },
      stubs: { EssentialTable: EssentialTableStub }
    }
  })
  await flushPromises()
  return wrapper
}

const showFilters = async (wrapper) => {
  await wrapper.findAll('button').find(button => button.text().includes('Show Filters')).trigger('click')
}

const lastListParams = () => usePicklistStore().getPicklistJobList.mock.lastCall[0]

describe('PicklistDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const options = useOptionStore()
    options.buildings = [
      {
        id: 1,
        name: 'Annex'
      },
      {
        id: 2,
        name: 'Main'
      }
    ]
    options.users = [
      {
        id: 7,
        name: 'Ann Lee'
      }
    ]
  })

  it('searches by job number with the param the API reads', async () => {
    const wrapper = await mountPage()
    await showFilters(wrapper)

    await wrapper.findComponent({ name: 'QInput' }).vm.$emit('update:modelValue', '123')
    wrapper.findComponent(EssentialTableStub).vm.$emit('update-pagination', {
      page: 1,
      size: 50
    })
    await flushPromises()

    expect(lastListParams().workflow_id).toBe('123')
    expect(lastListParams()).not.toHaveProperty('id')
  })

  it('does not send the user filter the API ignores', async () => {
    await mountPage()

    expect(lastListParams()).not.toHaveProperty('user_id')
  })

  it('keeps the sort when a filter changes by reloading through the table', async () => {
    const wrapper = await mountPage()
    await showFilters(wrapper)

    wrapper.findAllComponents(QSelect)[1].vm.$emit('update:modelValue', ['Running'])
    await flushPromises()

    expect(reloadFromFirstPage).toHaveBeenCalled()
  })

  it('offers every option no matter what the current page holds', async () => {
    usePicklistStore().picklistJobList = [
      {
        id: 1,
        status: 'Running',
        building: {
          id: 2,
          name: 'Main'
        }
      }
    ]
    const wrapper = await mountPage()
    await showFilters(wrapper)

    const [
      buildings,
      statuses,
      users
    ] = wrapper.findAllComponents(QSelect)
    expect(buildings.props('options').map(option => option.value)).toEqual([
      'Annex',
      'Main'
    ])
    expect(statuses.props('options').map(option => option.value)).toEqual([
      'Created',
      'Assigned',
      'Paused',
      'Running',
      'Completed'
    ])
    expect(users.props('options').map(option => option.value)).toEqual(['Ann Lee'])
  })

  it('loads the filter options itself, including after coming back from a job', async () => {
    await mountPage()

    const { getOptions } = useOptionStore()
    expect(getOptions).toHaveBeenCalledWith('buildings', { sort_by: 'name' })
    expect(getOptions).toHaveBeenCalledWith('users', expect.objectContaining({ sort_by: 'name' }))
  })

  it('shows Last Updated from the time the job actually changed', async () => {
    const wrapper = await mountPage()

    const column = wrapper.findComponent(EssentialTableStub).props('tableColumns')
      .find(col => col.label === 'Last Updated')
    expect(column.field).toBe('update_dt')
  })
})
