
<template>
  <div class="shipping-manifest">
    <div class="row items-center q-mb-md print-hide">
      <div class="col-auto">
        <BaseButton
          flat
          round
          icon="arrow_back"
          @click="$router.push({ name: 'shipping-execute', params: { jobId } })"
        />
      </div>
      <div class="col">
        <h1 class="text-h5 text-bold q-my-none">
          Shipping Manifest
        </h1>
      </div>
      <div class="col-auto">
        <div class="row q-gutter-x-sm">
          <BaseButton

            unelevated
            no-caps
            :color="scope === 'full' ? 'primary' : 'grey-3'"
            :text-color="scope === 'full' ? 'white' : 'black'"
            label="Full Job"
            @click="updateScope('full')"
          />
          <BaseButton

            unelevated
            no-caps
            :color="scope === 'location' ? 'primary' : 'grey-3'"
            :text-color="scope === 'location' ? 'white' : 'black'"
            label="By Location"
            @click="updateScope('location')"
          />
          <BaseButton

            unelevated
            no-caps
            :color="scope === 'bin' ? 'primary' : 'grey-3'"
            :text-color="scope === 'bin' ? 'white' : 'black'"
            label="By Bin"
            @click="updateScope('bin')"
          />
          <BaseButton
            class="q-ml-md"
            unelevated
            no-caps
            color="accent"
            icon="print"
            label="Print"
            @click="print"
          />
        </div>
      </div>
    </div>

    <!-- Filter by Location -->
    <div
      v-if="scope === 'location'"
      class="row q-mb-md print-hide"
    >
      <div class="col-12 col-md-4">
        <q-select
          v-model="selectedLocation"
          :options="locationOptions"
          option-label="name"
          option-value="id"
          label="Select Location"
          outlined
          dense
        />
      </div>
    </div>

    <!-- Filter by Bin -->
    <div
      v-if="scope === 'bin'"
      class="row q-mb-md print-hide"
    >
      <div class="col-12 col-md-4">
        <q-select
          v-model="selectedBin"
          :options="binOptions"
          option-label="barcode"
          option-value="id"
          label="Select Bin"
          outlined
          dense
        />
      </div>
    </div>

    <!-- Manifest Content -->
    <div
      v-if="loading"
      class="row justify-center q-pa-lg"
    >
      <q-spinner size="3em" />
    </div>

    <div
      v-else-if="manifestData"
      class="manifest-content q-pa-md bg-white"
    >
      <div class="text-h4 text-center q-mb-lg">
        Shipping Manifest
      </div>
      <div class="row q-mb-md">
        <div class="col-6">
          <div><strong>Job ID:</strong> #{{ manifestData.id }}</div>
          <div><strong>Completed Date:</strong> {{ formatDate(manifestData.completed_dt) }}</div>
        </div>
        <div class="col-6 text-right">
          <div><strong>Total Bins:</strong> {{ manifestData.bins?.length || 0 }}</div>
          <div><strong>Total Items:</strong> {{ totalItems }}</div>
        </div>
      </div>

      <table class="manifest-table full-width">
        <thead>
          <tr>
            <th class="text-left">
              Bin
            </th>
            <th class="text-left">
              Destination
            </th>
            <th class="text-left">
              Details
            </th>
            <th class="text-right">
              Items
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="bin in manifestData.bins"
            :key="bin.id"
          >
            <td>{{ bin.barcode }}</td>
            <td>{{ bin.delivery_location?.name || '-' }}</td>
            <td>
              <div
                v-for="item in bin.items"
                :key="item.id"
                class="text-caption"
              >
                ({{ item.barcode?.value }})
              </div>
              <div
                v-for="item in bin.non_tray_items"
                :key="'nt-' + item.id"
                class="text-caption"
              >
                ({{ item.barcode?.value }}) Non-Tray
              </div>
            </td>
            <td class="text-right">
              {{ bin.item_count }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Batch Sheet for Printing -->
    <ShippingManifestBatchSheet
      ref="batchSheetComponent"
      v-if="manifestData"
      :manifest-data="manifestData"
    />
  </div>
</template>

<script setup>
import BaseButton from '@/components/Base/BaseButton.vue'
import { ref, onMounted, computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useShippingStore } from '@/stores/shipping-store'
import { notify } from '@/utils/notify'
import ShippingManifestBatchSheet from '@/components/Shipping/ShippingManifestBatchSheet.vue'

const route = useRoute()
const { getManifest } = useShippingStore()
const dateFormatter = inject('format-date-time')

const jobId = route.params.jobId
const scope = ref('full')
const selectedLocation = ref(null)
const selectedBin = ref(null)
const loading = ref(false)
const batchSheetComponent = ref(null)

// The whole job, fetched once. Location and bin views filter it here, so
// changing them needs no request and the dropdowns always list every option.
const fullManifest = ref(null)

const manifestData = computed(() => {
  const data = fullManifest.value
  if (!data) {
    return null
  }
  if (scope.value === 'location' && selectedLocation.value) {
    return {
      ...data,
      bins: data.bins.filter(b => b.delivery_location_id === selectedLocation.value.id)
    }
  }
  if (scope.value === 'bin' && selectedBin.value) {
    return {
      ...data,
      bins: data.bins.filter(b => b.id === selectedBin.value.id)
    }
  }
  return data
})

const locationOptions = computed(() => {
  const unique = new Map()
  fullManifest.value?.bins?.forEach(bin => {
    if (bin.delivery_location) {
      unique.set(bin.delivery_location.id, bin.delivery_location)
    }
  })
  return Array.from(unique.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
})

const binOptions = computed(() => {
  return [...(fullManifest.value?.bins || [])].sort((a, b) => a.barcode.localeCompare(b.barcode))
})

const loadManifest = async () => {
  loading.value = true
  try {
    fullManifest.value = await getManifest(jobId, 'full')
  } catch (e) {
    notify({
      type: 'negative',
      message: 'Failed to load manifest'
    })
  } finally {
    loading.value = false
  }
}

const updateScope = (newScope) => {
  scope.value = newScope
  selectedLocation.value = null
  selectedBin.value = null
}

const print = () => {
  batchSheetComponent.value.printManifest()
}

// item_count is the server's count of tray and non-tray items in the bin
const totalItems = computed(() => {
  return manifestData.value?.bins?.reduce((sum, bin) => sum + (bin.item_count || 0), 0) || 0
})

const formatDate = (dt) => {
  if (!dt) {
    return '-'
  }
  const { date, time } = dateFormatter(dt)
  return `${date} ${time}`
}

onMounted(() => {
  loadManifest()
})
</script>

<style scoped>
.manifest-table {
    border-collapse: collapse;
}
.manifest-table th, .manifest-table td {
    border: 1px solid #ccc;
    padding: 8px;
}
</style>
