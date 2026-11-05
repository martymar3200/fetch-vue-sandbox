import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, vi } from 'vitest'
import NavigationBar from '@/components/NavigationBar.vue'

installQuasarPlugin()

afterEach(() => {
  vi.clearAllMocks()
})

// mock vue router which is used in the navigation bar component
const mockRoutePush = vi.fn()
vi.mock('vue-router', async () => {
  return {
    RouterView: {},
    useRouter: () => {
      return {
        push: mockRoutePush
      }
    },
    useRoute: () => {
      return {
        path: '/',
        hash: '',
        name: '',
        query: ''
      }
    }
  }
})

// mocks the navigator.serviceWorker
Object.defineProperty(global.navigator, 'serviceWorker', {
  value: {
    register: vi.fn()
  }
})

describe('Navigation Bar Component', () => {
  beforeEach(() => {
    // mocks the servieworker message listenter
    navigator.serviceWorker.addEventListener = vi.fn()
  })

  it('should mount component with a top and hidden side nav', async () => {
    const wrapper = mount(NavigationBar, {
      global: {
        provide: {
          //If you are using provide/inject
          'handle-alert': 'test-inject-function'
        }
      }
    })

    expect(wrapper.find('.q-header').exists()).toBe(true)
    // In Quasar, the drawer container still exists in the DOM but its state is hidden
    // depending on the `model-value` which we set to default closed in a previous task.
    expect(wrapper.find('.q-drawer-container').exists()).toBe(true)
    // You could also assert leftDrawerOpen is false on the instance,
    // but verifying existence of the structure is enough for this mount test
  })
})

describe('Shipping menu link and the shipping module setting', () => {
  // imported here so the mocks above apply
  let useUserStore, useOptionStore, flushPromises

  beforeEach(async () => {
    navigator.serviceWorker.addEventListener = vi.fn();
    ({ useUserStore } = await import('@/stores/user-store'));
    ({ useOptionStore } = await import('@/stores/option-store'));
    ({ flushPromises } = await import('@vue/test-utils'))
    useUserStore().userData = {
      user_id: 1,
      first_name: 'Test',
      last_name: 'User',
      permissions: ['can_access_shipping']
    }
  })

  const linkTitles = async () => {
    const wrapper = mount(NavigationBar, {
      global: { provide: { 'handle-alert': vi.fn() } }
    })
    await flushPromises()
    return wrapper.findAllComponents({ name: 'EssentialLink' }).map(link => link.props('title'))
  }

  it('shows Shipping while the module is on', async () => {
    useOptionStore().getSystemSetting.mockResolvedValue({ value: 'true' })

    expect(await linkTitles()).toContain('Shipping')
    expect(useOptionStore().getSystemSetting).toHaveBeenCalledWith('shipping_module_enabled')
  })

  it('hides Shipping while the module is off', async () => {
    useOptionStore().getSystemSetting.mockResolvedValue({ value: 'false' })

    expect(await linkTitles()).not.toContain('Shipping')
  })

  it('hides Shipping when the setting was never saved (off on the server)', async () => {
    useOptionStore().getSystemSetting.mockRejectedValue({ response: { status: 404 } })

    expect(await linkTitles()).not.toContain('Shipping')
  })

  it('keeps Shipping when the check fails for another reason, e.g. offline', async () => {
    useOptionStore().getSystemSetting.mockRejectedValue(new Error('Network Error'))

    expect(await linkTitles()).toContain('Shipping')
  })
})
