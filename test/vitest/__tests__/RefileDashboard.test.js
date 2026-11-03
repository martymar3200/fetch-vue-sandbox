import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RefileDashboard from 'src/components/Refile/RefileDashboard.vue'
import { useRefileStore } from 'src/stores/refile-store'
import { vi, describe, it, beforeEach, expect } from 'vitest'

installQuasarPlugin()

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))

vi.mock('@/composables/usePermissionHandler.js', () => ({
  usePermissionHandler: () => ({
    // without "view all", the screen used to send the user_id the API ignores
    checkUserPermission: vi.fn(permission => permission !== 'can_view_all_refile_jobs')
  })
}))

const EssentialTableStub = {
  name: 'EssentialTable',
  props: ['tableColumns'],
  methods: {
    clearSelectedData: vi.fn(),
    resetTablePagination: vi.fn()
  },
  template: `<div>
    <slot name="heading-row" />
    <table><thead><slot name="header-filter-row" :cols="tableColumns" /></thead></table>
  </div>`
}

const mountPage = async () => {
  const wrapper = mount(RefileDashboard, {
    global: {
      provide: { 'format-date-time': () => ({ date: '' }) },
      stubs: {
        EssentialTable: EssentialTableStub,
        RefileAddQueueItem: true,
        PopupModal: true,
        MobileActionBar: true
      }
    }
  })
  await flushPromises()
  return wrapper
}

const showFilters = async (wrapper) => {
  await wrapper.findAll('button').find(button => button.text().includes('Show Filters')).trigger('click')
}

const searchFirstFilter = async (wrapper, text) => {
  const input = wrapper.findComponent({ name: 'QInput' })
  await input.vm.$emit('update:modelValue', text)
  await input.find('input').trigger('keyup.enter')
  await flushPromises()
}

const lastJobListParams = () => useRefileStore().getRefileJobList.mock.lastCall[0]

describe('RefileDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('refile job filters', () => {
    it('searches by job number with the param the API reads', async () => {
      const wrapper = await mountPage()
      await showFilters(wrapper)

      await searchFirstFilter(wrapper, '123')

      expect(lastJobListParams().workflow_id).toBe('123')
      expect(lastJobListParams()).not.toHaveProperty('id')
    })

    it('only accepts digits in the job number search', async () => {
      const wrapper = await mountPage()
      await showFilters(wrapper)

      expect(wrapper.findComponent({ name: 'QInput' }).props('mask')).toBe('##########')
    })

    it('does not send the user filter the API ignores', async () => {
      await mountPage()

      expect(lastJobListParams()).not.toHaveProperty('user_id')
    })
  })
})
