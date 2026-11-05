
<template>
  <div class="shipping-dashboard">
    <div class="row q-mb-xs-xl q-mb-sm-none">
      <div class="col-grow q-mb-xs-md q-mb-sm-none">
        <EssentialTable
          ref="shippingTableRef"
          :table-columns="columns"
          :table-data="shippingJobList"
          :enable-pagination="true"
          :pagination-total="shippingJobListTotal"
          :heading-row-class="'q-mb-xs-md q-mb-md-lg'"
          :hide-table-rearrange="true"
          @update-pagination="loadJobs($event)"
          @selected-table-row="goToJob($event.id)"
        >
          <template #heading-row>
            <div
              class="col-sm-5 col-md-12 col-lg-auto"
              :class="currentScreenSize == 'sm' || currentScreenSize == 'xs' ? '' : 'self-center'"
            >
              <h1 class="text-h4 text-bold">
                Shipping Jobs
              </h1>
            </div>
            <div class="col-grow" />
            <div
              class="col-auto flex items-center"
              :class="currentScreenSize == 'sm' || currentScreenSize == 'xs' ? 'justify-end q-mb-md' : ''"
            >
              <BaseButton
                flat
                dense
                no-caps
                :color="showFilterRow ? 'accent' : 'grey-7'"
                :label="showFilterRow ? 'Hide Filters' : 'Show Filters'"
                :icon="showFilterRow ? 'filter_alt' : 'filter_alt_off'"
                class="q-mr-sm"
                @click="showFilterRow = !showFilterRow"
              />
              <BaseButton
                v-if="showFilterRow"
                flat
                dense
                no-caps
                color="grey-7"
                label="Clear"
                icon="clear_all"
                class="q-mr-md"
                @click="clearColumnFilters"
              />

              <BaseButton
                no-caps
                unelevated
                outline
                color="primary"
                label="Clear Bin"
                icon="delete_sweep"
                class="q-mr-md"
                @click="showClearBinModal = true"
              />

              <BaseButton
                no-caps
                unelevated
                color="accent"
                icon="add_circle"
                label="Create Shipping Job"
                class="text-body1 btn-modern"
                @click="submitCreateJob"
                :loading="creatingJob"
              />
            </div>
          </template>

          <!-- Filter row inside table header -->
          <template #header-filter-row="{ cols }">
            <q-tr
              v-if="showFilterRow"
              class="filter-row"
            >
              <q-th
                v-for="col in cols"
                :key="col.name"
                class="filter-cell"
              >
                <!-- Job # Filter -->
                <q-input
                  v-if="col.name === 'id'"
                  v-model="columnFilters.id"
                  dense
                  outlined
                  clearable
                  mask="##########"
                  inputmode="numeric"
                  placeholder="Search..."
                  class="column-filter-input"
                  debounce="400"
                  @update:model-value="applyColumnFilters"
                  @click.stop
                >
                  <template #prepend>
                    <q-icon
                      name="search"
                      size="16px"
                      color="grey-6"
                    />
                  </template>
                </q-input>

                <!-- Status Filter -->
                <q-select
                  v-else-if="col.name === 'status'"
                  v-model="columnFilters.status"
                  dense
                  outlined
                  clearable
                  multiple
                  :options="['Created', 'Assigned', 'Running', 'Paused', 'Completed']"
                  placeholder="Status"
                  class="column-filter-input"
                  @update:model-value="applyColumnFilters"
                  @click.stop
                />

                <!-- Assigned User Filter: full names, which the API matches exactly -->
                <q-select
                  v-else-if="col.name === 'assigned_user_id'"
                  v-model="columnFilters.assigned_user"
                  dense
                  outlined
                  clearable
                  multiple
                  emit-value
                  map-options
                  :options="userOptions"
                  placeholder="All"
                  class="column-filter-input"
                  @update:model-value="applyColumnFilters"
                  @click.stop
                />

              </q-th>
            </q-tr>
          </template>

          <template #table-td="{ colName, value, props }">
            <span
              v-if="colName == 'status'"
              class="status-badge"
              :class="getStatusBadgeClass(value)"
            >
              {{ value }}
            </span>
            <span v-else-if="colName == 'create_dt'">
              {{ formatDate(value) }}
            </span>

            <div v-else-if="colName == 'actions'">
              <BaseButton
                flat
                round
                dense
                icon="more_vert"
                @click.stop
              >
                <q-menu>
                  <q-list style="min-width: 150px">
                    <q-item
                      clickable
                      v-close-popup
                      :disable="props.row.status !== 'Completed'"
                      @click="router.push({ name: 'shipping-manifest', params: { jobId: props.row.id } })"
                    >
                      <q-item-section>View Manifest</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </BaseButton>
            </div>
            <span v-else-if="colName == 'last_transition'">
              {{ formatDate(value) }}
            </span>
          </template>

        </EssentialTable>
      </div>
    </div>

    <!-- Modals -->
    <ShippingClearBinModal
      v-if="showClearBinModal"
      @close="showClearBinModal = false"
    />
  </div>
</template>

<script setup>
import BaseButton from '@/components/Base/BaseButton.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { notify } from '@/utils/notify'
import { useShippingStore } from '@/stores/shipping-store'
import { useOptionStore } from '@/stores/option-store'
import { useCurrentScreenSize } from '@/composables/useCurrentScreenSize.js'
import EssentialTable from '@/components/EssentialTable.vue'
import ShippingClearBinModal from '@/components/Shipping/ShippingClearBinModal.vue'

const router = useRouter()
const store = useShippingStore()
const { shippingJobList, shippingJobListTotal } = storeToRefs(store)
const { getShippingJobList, createShippingJob } = store
const { users } = storeToRefs(useOptionStore())
const { getOptions } = useOptionStore()
const { currentScreenSize } = useCurrentScreenSize()

const showClearBinModal = ref(false)
const creatingJob = ref(false)
const showFilterRow = ref(false)
const emptyFilters = () => ({
  id: null,
  status: null,
  assigned_user: null
})
const columnFilters = ref(emptyFilters())
// Last sort the table asked for, kept when a filter changes
const tableSort = ref({})

const userOptions = computed(() =>
  users.value.map(u => ({
    label: u.name,
    value: u.name
  }))
)

// Columns
const columns = [
  {
    name: 'id',
    field: 'id',
    label: 'Job #',
    align: 'left',
    sortable: true
  },
  {
    name: 'status',
    field: 'status',
    label: 'Status',
    align: 'left',
    sortable: true
  },
  {
    name: 'create_dt',
    field: 'create_dt',
    label: 'Created',
    align: 'left',
    sortable: true
  },
  {
    name: 'last_transition',
    field: 'last_transition',
    label: 'Last Updated',
    align: 'left',
    sortable: true
  },
  {
    name: 'assigned_user_id',
    field: row => {
      if (!row.assigned_user) {
        return 'Unassigned'
      }
      return row.assigned_user.name ? row.assigned_user.name : `${row.assigned_user.first_name} ${row.assigned_user.last_name}`
    },
    label: 'Assigned User',
    align: 'left'
  },
  {
    name: 'actions',
    field: 'actions',
    label: '',
    align: 'right',
    sortable: false
  }
]

// Logic
// Sends only the params the API reads (EssentialTable's event also carries
// Quasar's rowsPerPage/sortBy/descending/rowsNumber)
const loadJobs = async (pagination = {}) => {
  if (pagination.sort_by !== undefined || pagination.page !== undefined) {
    tableSort.value = pagination.sort_by
      ? {
          sort_by: pagination.sort_by,
          sort_order: pagination.sort_order
        }
      : {}
  }

  const params = {
    page: pagination.page || 1,
    size: pagination.size || pagination.rowsPerPage || 25,
    status: columnFilters.value.status?.length ? columnFilters.value.status : [
      'Created',
      'Assigned',
      'Running',
      'Paused'
    ],
    ...tableSort.value
  }
  if (columnFilters.value.id) {
    params.workflow_id = columnFilters.value.id
  }
  if (columnFilters.value.assigned_user?.length) {
    params.assigned_user = columnFilters.value.assigned_user
  }
  try {
    await getShippingJobList(params)
  } catch (error) {
    // e.g. "Shipping module is disabled" when the page is opened directly
    notify({
      type: 'negative',
      message: error.response?.data?.detail || 'Failed to load shipping jobs'
    })
  }
}

const applyColumnFilters = () => {
  loadJobs()
}

const clearColumnFilters = () => {
  columnFilters.value = emptyFilters()
  loadJobs()
}

const loadUserOptions = async () => {
  try {
    await getOptions('users', {
      sort_by: 'name',
      size: 100
    })
  } catch (error) {
    notify({
      type: 'negative',
      message: error.response?.data?.detail || 'Failed to load the user list'
    })
  }
}

const submitCreateJob = async () => {
  creatingJob.value = true
  try {
    const job = await createShippingJob({})
    notify({
      type: 'positive',
      message: `Job ${job.id} Created`
    })
    router.push({
      name: 'shipping-execute',
      params: { jobId: job.id }
    })
  } catch (e) {
    notify({
      type: 'negative',
      message: 'Failed to create job'
    })
  } finally {
    creatingJob.value = false
  }
}

const goToJob = (id) => {
  router.push({
    name: 'shipping-execute',
    params: { jobId: id }
  })
}

const formatDate = (val) => {
  if (!val) {
    return '-'
  }
  return new Date(val).toLocaleString()
}

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'Created': return 'status-badge--created'
    case 'Assigned': return 'status-badge--assigned'
    case 'Running': return 'status-badge--running'
    case 'Completed': return 'status-badge--completed'
    default: return 'status-badge--default'
  }
}

onMounted(() => {
  loadJobs()
  loadUserOptions()
})

</script>
