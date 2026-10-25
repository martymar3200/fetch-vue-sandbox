import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount } from '@vue/test-utils'
import AccessionContainerDisplay from 'src/components/Accession/AccessionContainerDisplay.vue'
import { useAccessionStore } from 'src/stores/accession-store'
import { vi, describe, it, expect } from 'vitest'
import { reactive, ref } from 'vue'

installQuasarPlugin()

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => reactive({ params: {} })),
  useRouter: vi.fn(() => ({ push: vi.fn() }))
}))

vi.mock('@/composables/useCurrentScreenSize.js', () => ({
  useCurrentScreenSize: () => ({
    currentScreenSize: ref('lg')
  })
}))

vi.mock('@/composables/usePermissionHandler.js', () => ({
  usePermissionHandler: () => ({
    checkUserPermission: vi.fn().mockReturnValue(true)
  })
}))

const mountDisplay = () => mount(AccessionContainerDisplay, {
  global: {
    provide: {
      'get-item-location': vi.fn().mockReturnValue('N/A'),
      'format-date-time': vi.fn().mockReturnValue({
        date: 'N/A',
        time: 'N/A'
      }),
      'get-nested-key-path': vi.fn().mockReturnValue('N/A'),
      'render-item-barcode-display': vi.fn().mockReturnValue('N/A'),
      'audio-alert': vi.fn()
    }
  }
})

describe('AccessionContainerDisplay', () => {
  describe('trayItemCounts', () => {
    it('counts items per tray from the job items (job trays have no items list)', () => {
      const store = useAccessionStore()
      store.accessionJob = {
        id: 5,
        workflow_id: 7,
        trayed: true,
        status: 'Running',
        non_tray_items: [],
        trays: [
          {
            id: 10,
            barcode: { value: 'AL000010' }
          },
          {
            id: 11,
            barcode: { value: 'AL000011' }
          },
          {
            id: 12,
            barcode: { value: 'AL000012' }
          }
        ],
        items: [
          {
            id: 1,
            tray_id: 10
          },
          {
            id: 2,
            tray_id: 10
          },
          {
            id: 3,
            tray_id: 11
          }
        ]
      }

      const wrapper = mountDisplay()

      expect(wrapper.vm.trayItemCounts[10]).toBe(2)
      expect(wrapper.vm.trayItemCounts[11]).toBe(1)
      expect(wrapper.vm.trayItemCounts[12]).toBeUndefined()

      const trayRows = wrapper.findAll('.accession-next-tray-item').map(row => row.text())
      expect(trayRows).toEqual([
        'AL0000102 Items',
        'AL0000111 Items',
        'AL0000120 Items'
      ])
    })

    it('updates when an item is added to the job', async () => {
      const store = useAccessionStore()
      store.accessionJob = {
        id: 5,
        workflow_id: 7,
        trayed: true,
        status: 'Running',
        non_tray_items: [],
        trays: [
          {
            id: 10,
            barcode: { value: 'AL000010' }
          }
        ],
        items: [
          {
            id: 1,
            tray_id: 10
          }
        ]
      }

      const wrapper = mountDisplay()
      store.accessionJob.items = [
        ...store.accessionJob.items,
        {
          id: 2,
          tray_id: 10
        }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.trayItemCounts[10]).toBe(2)
    })
  })
})
