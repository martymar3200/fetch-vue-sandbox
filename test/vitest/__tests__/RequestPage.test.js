import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import RequestPage from 'src/pages/RequestPage.vue'
import { describe, vi, beforeEach, it, expect } from 'vitest'
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { useRequestStore } from 'src/stores/request-store'
import { useOptionStore } from 'src/stores/option-store'
import { useGlobalStore } from 'src/stores/global-store'
import { notify } from 'src/utils/notify'

installQuasarPlugin()
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => reactive({})),
  useRouter: vi.fn(() => ({}))
}))
vi.mock('@/utils/notify', () => ({
  notify: vi.fn()
}))
describe('RequestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  describe('onMounted', async () => {
    it('should call getOptions if jobId is in the route params', async () => {
      const optionsStore = useOptionStore()
      vi.spyOn(optionsStore, 'getOptions').mockResolvedValue({})

      vi.mocked(useRoute).mockReturnValue(
        reactive({
          name: 'requests',
          path: 'requests',
          params: {
            notJobId: '123'
          }
        })
      )

      mount(RequestPage, {})

      expect(optionsStore.getOptions).toHaveBeenCalled()
    })
    it('should call getRequestBatchJob if request-batch is the route name', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestBatchJob').mockResolvedValue({})

      vi.mocked(useRoute).mockReturnValue(
        reactive({
          name: 'request-batch',
          path: 'request-batch',
          params: {
            jobId: '123'
          }
        })
      )

      mount(RequestPage, {})

      expect(requestStore.getRequestBatchJob).toHaveBeenCalled()
    })
    it('should call getRequestJob if request-details is the route name', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJob').mockResolvedValue({})

      vi.mocked(useRoute).mockReturnValue(
        reactive({
          name: 'request-details',
          path: 'request-details',
          params: {
            jobId: '123'
          }
        })
      )

      mount(RequestPage, {
        shallow: true
      })

      expect(requestStore.getRequestJob).toHaveBeenCalled()
    })
  })

  describe('when the request fails to load', () => {
    it('stops loading and notifies', async () => {
      const requestStore = useRequestStore()
      vi.spyOn(requestStore, 'getRequestJob').mockRejectedValue({
        response: { data: { detail: 'Request ID 9 Not Found' } }
      })
      vi.mocked(useRoute).mockReturnValue(
        reactive({
          name: 'request-details',
          path: 'request',
          params: { jobId: '9' }
        })
      )

      mount(RequestPage, { shallow: true })
      await flushPromises()

      expect(useGlobalStore().pageInitLoading).toBe(false)
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'negative',
        message: 'Request ID 9 Not Found'
      }))
    })
  })
})
