<template>
  <div class="shelving-move-execute">
    <!-- Header using shared component -->
    <JobPageHeader
      :title="moveType === 'tray-item' ? 'Move Items to Tray' : 'Move Containers to Shelf'"
      :job-id="job?.id"
      :status="job?.status"
      :status-color="getStatusColor(job?.status)"
      :subtitle="subtitle"
      :menu-options="menuOptions"
    >
      <template #actions>
        <JobActionButtons
          v-if="job?.status !== 'Completed'"
          :status="job?.status || 'Created'"
          :can-complete="containers.length > 0 && !scanning"
          :loading="actionLoading"
          @start="startJob"
          @complete="showCompleteDialog = true"
        />
      </template>
    </JobPageHeader>

    <!-- Progress Bar -->
    <JobProgressBar
      :completed="movedCount"
      :total="containers.length"
    />

    <!-- Not Started Message -->
    <q-card
      v-if="job?.status === 'Created' || job?.status === 'Assigned'"
      class="q-mb-lg"
    >
      <q-card-section class="text-center q-pa-lg">
        <q-icon
          name="swap_horiz"
          size="64px"
          color="accent"
          class="q-mb-md"
        />
        <div class="text-h6 q-mb-sm">
          Ready to Start
        </div>
        <p class="text-grey-7">
          Click "Start Job" to begin moving containers.
        </p>
      </q-card-section>
    </q-card>

    <!-- Destination Scan Card (only when job is Running) -->
    <q-card
      v-if="job?.status === 'Running'"
      class="q-mb-lg"
    >
      <q-card-section>
        <div class="row q-col-gutter-md">
          <!-- Destination Scan Section -->
          <div class="col-12 col-md-6">
            <label class="form-group-label">
              {{ moveType === 'tray-item' ? 'Destination Tray' : 'Destination Shelf' }}
            </label>
            <div
              v-if="currentDestination"
              class="text-h5 text-weight-bold text-accent"
            >
              {{ currentDestination }}
            </div>
            <q-input
              v-else
              v-model="destinationBarcodeInput"
              outlined
              dense
              :placeholder="moveType === 'tray-item' ? 'Scan tray barcode' : 'Scan shelf barcode'"
              @keyup.enter="scanDestination"
              ref="destinationInput"
              autofocus
              :inputmode="keyboardEnabled ? 'numeric' : 'none'"
              @click="handleInputClick(destinationInput)"
              @blur="handleInputBlur"
            >
              <template #append>
                <q-icon :name="moveType === 'tray-item' ? 'inbox' : 'shelves'" />
              </template>
            </q-input>
          </div>

          <!-- Destination Details -->
          <div
            v-if="currentDestination"
            class="col-12 col-md-6"
          >
            <div class="row q-gutter-md">
              <div class="col">
                <div class="text-caption text-grey-6">
                  Owner
                </div>
                <div class="text-body1">
                  {{ destinationOwner || '-' }}
                </div>
              </div>
              <div class="col">
                <div class="text-caption text-grey-6">
                  Size Class
                </div>
                <div class="text-body1">
                  {{ destinationSizeClass || '-' }}
                </div>
              </div>
              <div class="col-auto">
                <BaseButton
                  flat
                  no-caps
                  color="grey-7"
                  :label="moveType === 'tray-item' ? 'Change Tray' : 'Change Shelf'"
                  icon="refresh"
                  @click="clearDestination"
                />
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Container Scan Section (only when destination is selected) -->
    <q-card
      v-if="currentDestination && job?.status === 'Running'"
      class="q-mb-lg bg-accent-1"
    >
      <q-card-section>
        <div class="row q-col-gutter-md items-end">
          <div :class="moveType === 'tray-item' ? 'col-12 col-md-9' : 'col-12 col-md-6'">
            <label class="form-group-label">
              {{ moveType === 'tray-item' ? 'Scan Item Barcode' : 'Scan Container Barcode' }}
            </label>
            <q-input
              v-model="containerBarcodeInput"
              outlined
              dense
              :placeholder="moveType === 'tray-item' ? 'Scan item barcode' : 'Scan tray or non-tray barcode'"
              @keyup.enter="scanContainer"
              ref="containerInput"
              :inputmode="keyboardEnabled ? 'numeric' : 'none'"
              @click="handleInputClick(containerInput)"
              @blur="handleInputBlur"
            >
              <template #append>
                <q-icon name="qr_code_scanner" />
              </template>
            </q-input>
          </div>
          <div
            v-if="moveType !== 'tray-item'"
            class="col-12 col-md-3"
          >
            <label class="form-group-label">Position #</label>
            <q-input
              v-model.number="positionNumber"
              type="number"
              outlined
              dense
              min="1"
              :placeholder="nextPosition ? `Next: ${nextPosition}` : 'Position'"
            />
          </div>
          <div class="col-12 col-md-3">
            <BaseButton
              no-caps
              unelevated
              color="accent"
              label="Move"
              class="full-width"
              :loading="scanning"
              :disable="!containerBarcodeInput || (moveType !== 'tray-item' && !positionNumber)"
              @click="moveContainer"
            />
          </div>
        </div>

        <!-- Scan Error -->
        <div
          v-if="scanError"
          class="text-negative q-mt-sm"
          role="alert"
        >
          {{ scanError }}
        </div>
      </q-card-section>
    </q-card>

    <!-- Container List -->
    <q-card>
      <q-card-section>
        <div class="row items-center q-mb-md">
          <div class="col">
            <div class="text-h6">
              Containers to Move
            </div>
          </div>
          <div class="col-auto">
            <q-badge
              color="accent"
              :label="`${movedCount}/${containers.length}`"
            />
          </div>
        </div>

        <q-table
          v-if="containers.length > 0"
          :rows="containers"
          :columns="containerColumns"
          row-key="barcode"
          flat
          dense
          :pagination="{ rowsPerPage: 15 }"
          class="essential-table"
        >
          <template #body-cell-barcode="props">
            <q-td :props="props">
              <span class="text-weight-medium">{{ props.row.barcode?.value || props.row.barcode || '-' }}</span>
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="rowStatus(props.row).color"
                :text-color="rowStatus(props.row).textColor"
                :label="rowStatus(props.row).label"
              />
            </q-td>
          </template>
        </q-table>

        <div
          v-else
          class="text-center text-grey-6 q-py-lg"
        >
          <q-icon
            name="inventory_2"
            size="48px"
            class="q-mb-sm"
          />
          <div>No containers moved yet</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Complete Job Dialog -->
    <JobConfirmDialog
      v-model="showCompleteDialog"
      title="Complete Move Job?"
      message="Each move has already been saved as it was scanned. Are you sure you want to complete this move job?"
      confirm-label="Complete"
      confirm-color="positive"
      :loading="completing"
      @confirm="completeJob"
    />

    <!-- Cancel Job Dialog -->
    <JobConfirmDialog
      v-model="showCancelDialog"
      title="Cancel Move Job?"
      message="Are you sure you want to cancel this move job?"
      confirm-label="Yes, Cancel"
      confirm-color="negative"
      :loading="cancelling"
      @confirm="cancelJob"
    />

    <!-- Audit Trail Modal -->
    <AuditTrail
      v-if="showAuditTrailModal"
      ref="historyModal"
      @reset="showAuditTrailModal = false"
      job-type="shelving_jobs"
      :job-id="job?.id"
    />
  </div>
</template>

<script setup>
import BaseButton from '@/components/Base/BaseButton.vue'
import { ref, computed, onMounted, watch, nextTick, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useShelvingStore } from '@/stores/shelving-store'
import { useGlobalStore } from '@/stores/global-store'
import { useBarcodeStore } from '@/stores/barcode-store'
import { storeToRefs } from 'pinia'
import { notify } from '@/utils/notify'
import { useBarcodeScanHandler } from '@/composables/useBarcodeScanHandler.js'
import { usePermissionHandler } from '@/composables/usePermissionHandler.js'
import { useIndexDbHandler } from '@/composables/useIndexDbHandler.js'

// Shared Job Components
import JobPageHeader from '@/components/Job/JobPageHeader.vue'
import JobProgressBar from '@/components/Job/JobProgressBar.vue'
import JobActionButtons from '@/components/Job/JobActionButtons.vue'
import JobConfirmDialog from '@/components/Job/JobConfirmDialog.vue'
import AuditTrail from '@/components/AuditTrail.vue'

const router = useRouter()
const route = useRoute()
const shelvingStore = useShelvingStore()
const barcodeStore = useBarcodeStore()


// Composables
const { compiledBarCode } = useBarcodeScanHandler()
const { checkUserPermission } = usePermissionHandler()
const { addDataToIndexDb, getDataInIndexDb, deleteDataInIndexDb } = useIndexDbHandler()



// Store refs
const { appIsLoadingData, appIsOffline, appPendingSync } = storeToRefs(useGlobalStore())
const { shelvingJob } = storeToRefs(shelvingStore)
const { barcodeDetails } = storeToRefs(barcodeStore)
const {
  patchShelvingJob,
  postShelvingJobContainer,
  getShelfByBarcode,
  getShelvingTrayContainerDetails,
  getShelvingTrayItemDetails,
  getShelvingNonTrayItemDetails,
  getShelvingJob
} = shelvingStore
const { verifyBarcode } = barcodeStore

// Injected helpers
const currentIsoDate = inject('current-iso-date')
const getItemLocation = inject('get-item-location')

// Props from route
const moveType = computed(() => route.params.type || 'tray-non-tray')

// Local State
const job = computed(() => shelvingJob.value)
const containers = ref([])
const destinationBarcodeInput = ref('')
const containerBarcodeInput = ref('')
const positionNumber = ref(null)
const scanning = ref(false)
const actionLoading = ref(false)
const completing = ref(false)
const cancelling = ref(false)
const scanError = ref('')
const showCompleteDialog = ref(false)
const showCancelDialog = ref(false)
const showAuditTrailModal = ref(false)
const keyboardEnabled = ref(false)

// Destination state
const currentDestination = ref('')
const currentDestinationLocation = ref('')
const destinationOwner = ref('')
const destinationSizeClass = ref('')
const destinationId = ref(null)
const nextPosition = ref(null)

// Input refs
const destinationInput = ref(null)
const containerInput = ref(null)

// Computed
const movedCount = computed(() => containers.value.filter(c => c.scanned_for_transfer).length)
const subtitle = computed(() => {
  const parts = []
  if (destinationOwner.value) {
    parts.push(destinationOwner.value)
  }
  if (destinationSizeClass.value) {
    parts.push(destinationSizeClass.value)
  }
  parts.push(`${movedCount.value}/${containers.value.length} moved`)
  return parts.join(' • ')
})

const menuOptions = computed(() => {
  const options = []

  options.push({
    label: 'View History',
    icon: 'history',
    color: 'grey',
    action: () => viewHistory()
  })

  if (job.value?.status === 'Created') {
    options.push({
      label: 'Cancel Job',
      icon: 'cancel',
      color: 'negative',
      action: () => {
        showCancelDialog.value = true
      }
    })
  }

  return options
})

const containerColumns = computed(() => {
  const cols = [
    {
      name: 'barcode',
      label: 'Barcode',
      field: row => row.barcode?.value || row.barcode,
      align: 'left',
      sortable: true
    },
    {
      name: 'owner',
      label: 'Owner',
      field: row => row.owner?.name || '-',
      align: 'left'
    }
  ]

  if (moveType.value !== 'tray-item') {
    cols.push({
      name: 'location',
      label: 'Shelving Location',
      field: row => row.display_location || '-',
      align: 'left'
    })
  }

  cols.push(
    {
      name: 'status',
      label: 'Status',
      field: 'scanned_for_transfer',
      align: 'center'
    }
  )

  return cols
})

const rowStatus = (row) => {
  if (row.queued_offline) {
    return {
      label: 'Queued (offline)',
      color: 'warning',
      textColor: 'black'
    }
  }
  if (row.scanned_for_transfer) {
    return {
      label: 'Moved',
      color: 'positive',
      textColor: 'white'
    }
  }
  // Only rows saved by the older version of this page, which queued scans until Complete
  return {
    label: 'Not moved - scan again',
    color: 'grey-8',
    textColor: 'white'
  }
}

const barcodeValue = (row) => row.barcode?.value || row.barcode

// Methods
const handleInputClick = (inputRef) => {
  if (!keyboardEnabled.value) {
    keyboardEnabled.value = true
    nextTick(() => {
      inputRef?.focus()
    })
  }
}

const handleInputBlur = () => {
  keyboardEnabled.value = false
}

const getStatusColor = (status) => {
  const colors = {
    Created: 'grey',
    Running: 'info',
    Paused: 'warning',
    Completed: 'positive'
  }
  return colors[status] || 'grey'
}

const startJob = async () => {
  actionLoading.value = true
  try {
    await patchShelvingJob({
      id: job.value.id,
      status: 'Running'
    })
    notify({
      type: 'positive',
      message: 'Move job started!'
    })
    saveState()
  } catch (error) {
    notify({
      type: 'negative',
      message: 'Failed to start job'
    })
  } finally {
    actionLoading.value = false
  }
}

const viewHistory = () => {
  showAuditTrailModal.value = true
}

const cancelJob = async () => {
  cancelling.value = true
  try {
    await patchShelvingJob({
      id: job.value.id,
      status: 'Cancelled'
    })
    showCancelDialog.value = false
    notify({
      type: 'info',
      message: 'Move job cancelled'
    })
    deleteDataInIndexDb('shelvingStore', 'moveJob')
    router.push({ name: 'shelving' })
  } catch (error) {
    notify({
      type: 'negative',
      message: 'Failed to cancel job'
    })
  } finally {
    cancelling.value = false
  }
}

const scanDestination = async () => {
  if (!destinationBarcodeInput.value) {
    return
  }

  if (!checkUserPermission('can_move_trays_and_items_shelving_locations')) {
    notify({
      type: 'negative',
      message: 'Permission denied'
    })
    return
  }

  try {
    appIsLoadingData.value = true
    scanError.value = ''

    if (moveType.value === 'tray-item') {
      // Scanning a tray as destination
      try {
        const res = await getShelvingTrayContainerDetails(destinationBarcodeInput.value)
        currentDestination.value = res.data.barcode.value
        destinationOwner.value = res.data.owner?.name || ''
        destinationSizeClass.value = res.data.size_class?.name || ''
        destinationId.value = res.data.id
      } catch (error) {
        // Offline (or the request failed before the 'offline' event fired): accept the
        // scanned tray as-is; the server validates it when the queued moves sync.
        if (!appIsOffline.value && error?.code !== 'ERR_NETWORK') {
          throw error
        }
        currentDestination.value = destinationBarcodeInput.value
        destinationOwner.value = 'Offline (Pending Sync)'
        destinationSizeClass.value = ''
        destinationId.value = null
      }
    } else {
      // Scanning a shelf as destination (the store falls back to the scanned barcode offline)
      const res = await getShelfByBarcode(destinationBarcodeInput.value)
      currentDestination.value = res.data.barcode.value
      currentDestinationLocation.value = res.data.location
      destinationOwner.value = res.data.owner?.name || ''
      destinationSizeClass.value = res.data.shelf_type?.size_class?.name || ''
      destinationId.value = res.data.id
      nextPosition.value = shelvingJob.value.nextAvailablePosition
      positionNumber.value = nextPosition.value
    }

    destinationBarcodeInput.value = ''
    saveState()

    nextTick(() => {
      containerInput.value?.focus()
    })
  } catch (error) {
    notify({
      type: 'negative',
      message: error?.response?.data?.detail || 'Failed to scan destination'
    })
  } finally {
    appIsLoadingData.value = false
  }
}

const clearDestination = () => {
  currentDestination.value = ''
  currentDestinationLocation.value = ''
  destinationOwner.value = ''
  destinationSizeClass.value = ''
  destinationId.value = null
  nextPosition.value = null
  positionNumber.value = null
  scanError.value = ''
  saveState()

  nextTick(() => {
    destinationInput.value?.focus()
  })
}

// Look up the scanned container for the list (owner, size class, type). Needs the
// server, so it's skipped offline; the server still validates the move when it syncs.
const lookupContainer = async (barcode) => {
  if (moveType.value === 'tray-item') {
    await verifyBarcode(barcode, 'Item')
    const res = await getShelvingTrayItemDetails(barcode)
    return {
      ...res.data,
      container_type: { type: 'Item' }
    }
  }

  await verifyBarcode(barcode, [
    'Item',
    'Tray'
  ])
  if (barcodeDetails.value?.type?.name === 'Tray') {
    const res = await getShelvingTrayContainerDetails(barcode)
    return {
      ...res.data,
      container_type: { type: 'Tray' }
    }
  }
  const res = await getShelvingNonTrayItemDetails(barcode)
  return {
    ...res.data,
    container_type: { type: 'Non-Tray' }
  }
}

const upsertContainer = (row) => {
  const index = containers.value.findIndex(c => barcodeValue(c) === barcodeValue(row))
  if (index === -1) {
    containers.value.push(row)
  } else {
    // Re-scanning a container already in this job moves it again (e.g. to fix a mistake)
    containers.value.splice(index, 1, row)
  }
}

// Save one move as soon as it's scanned, the same way Direct to Shelf does.
const scanContainer = async () => {
  const barcode = containerBarcodeInput.value?.trim()
  if (!barcode) {
    return
  }

  if (scanning.value) {
    scanError.value = 'Still saving the previous move. Scan this container again.'
    return
  }

  const isShelfMove = moveType.value !== 'tray-item'
  if (isShelfMove && !positionNumber.value) {
    scanError.value = appIsOffline.value || nextPosition.value ? 'Position required' : 'Shelf is full'
    return
  }

  scanning.value = true
  scanError.value = ''
  const position = isShelfMove ? parseInt(positionNumber.value) : null

  try {
    const details = appIsOffline.value ? null : await lookupContainer(barcode)

    const payload = {
      job_id: job.value.id,
      container_barcode_value: barcode,
      scanned_for_shelving: true,
      shelved_dt: currentIsoDate()
    }
    if (isShelfMove) {
      payload.shelf_barcode_value = currentDestination.value
      payload.shelf_position_number = position
      if (details) {
        payload.trayed = details.container_type.type === 'Tray'
      }
    } else {
      payload.destination_tray_barcode_value = currentDestination.value
    }

    const res = await postShelvingJobContainer(payload)
    const savedOnServer = Boolean(res?.fromServer)

    upsertContainer({
      ...(details || {}),
      id: res?.data?.shelving_container_id ?? details?.id ?? null,
      barcode: details?.barcode || { value: barcode },
      owner: details?.owner || null,
      size_class: details?.size_class || null,
      container_type: details?.container_type || null,
      new_shelf_position: position,
      destination_tray_barcode: isShelfMove ? undefined : currentDestination.value,
      display_location: isShelfMove
        ? getItemLocation({
          shelf_position: {
            location: `${currentDestinationLocation.value}-${position}`
          }
        })
        : undefined,
      scanned_for_transfer: true,
      queued_offline: !savedOnServer
    })

    if (isShelfMove) {
      if (savedOnServer) {
        // Server says where the next free spot is (null when the shelf is now full)
        nextPosition.value = res.data?.next_available_position ?? null
        positionNumber.value = nextPosition.value
      } else {
        positionNumber.value = position + 1
      }
    }

    containerBarcodeInput.value = ''
    saveState()

    notify({
      type: savedOnServer ? 'positive' : 'info',
      message: savedOnServer ? 'Container moved!' : 'Move queued. It will be saved when you are back online.'
    })
  } catch (error) {
    // The server has already recorded a move discrepancy for rejected moves
    scanError.value = error?.response?.data?.detail || (typeof error === 'string' ? error : '') || 'Failed to move container'
    notify({
      type: 'negative',
      message: scanError.value
    })
  } finally {
    scanning.value = false
    nextTick(() => {
      containerInput.value?.focus()
    })
  }
}

const moveContainer = () => scanContainer()

const completeJob = async () => {
  if (scanning.value) {
    return
  }
  completing.value = true
  try {
    await patchShelvingJob({
      id: job.value.id,
      status: 'Completed',
      run_timestamp: currentIsoDate()
    })

    showCompleteDialog.value = false
    notify({
      type: 'positive',
      message: 'Move job completed!'
    })
    deleteDataInIndexDb('shelvingStore', 'moveJob')
    router.push({ name: 'shelving' })
  } catch (error) {
    notify({
      type: 'negative',
      message: error?.response?.data?.detail || 'Failed to complete job'
    })
  } finally {
    completing.value = false
  }
}

const saveState = () => {
  const state = {
    jobId: job.value?.id,
    containers: JSON.parse(JSON.stringify(containers.value)),
    destination: currentDestination.value,
    destinationLocation: currentDestinationLocation.value,
    destinationOwner: destinationOwner.value,
    destinationSizeClass: destinationSizeClass.value,
    destinationId: destinationId.value,
    nextPosition: nextPosition.value,
    positionNumber: positionNumber.value,
    // Snapshot of the job so the page can reopen offline
    job: JSON.parse(JSON.stringify(job.value || {}))
  }
  addDataToIndexDb('shelvingStore', 'moveJob', state)
}

const readSavedState = async (jobId) => {
  const res = await getDataInIndexDb('shelvingStore')
  // Use loose equality to handle string/number mismatch
  if (res?.data?.moveJob && res.data.moveJob.jobId == jobId) {
    return res.data.moveJob
  }
  return null
}

const restoreDestination = (saved) => {
  currentDestination.value = saved.destination || ''
  currentDestinationLocation.value = saved.destinationLocation || ''
  destinationOwner.value = saved.destinationOwner || ''
  destinationSizeClass.value = saved.destinationSizeClass || ''
  destinationId.value = saved.destinationId || null
  nextPosition.value = saved.nextPosition || null
  positionNumber.value = saved.positionNumber || nextPosition.value
}

const loadState = (saved) => {
  if (saved.job?.id && shelvingJob.value?.id != saved.jobId) {
    shelvingJob.value = saved.job
  }
  containers.value = saved.containers || []
  restoreDestination(saved)
}

const mapServerContainers = (shelvingJobContainers) => {
  const rows = shelvingJobContainers.map(c => ({
    id: c.id,
    barcode: c.tray?.barcode || c.non_tray_item?.barcode || c.item?.barcode || { value: c.container_barcode },
    owner: c.tray?.owner || c.non_tray_item?.owner || c.item?.tray?.owner,
    size_class: c.tray?.size_class || c.non_tray_item?.size_class,
    container_type: c.tray ? { type: 'Tray' } : c.non_tray_item ? { type: 'Non-Tray' } : { type: 'Item' },
    new_shelf_position: c.shelf_position_number,
    scanned_for_transfer: true,
    queued_offline: false,
    destination_tray_barcode: c.destination_tray?.barcode?.value,
    display_location: c.actual_shelf_position ? getItemLocation(c.actual_shelf_position) : '-'
  }))

  // An item moved more than once in this job has one record per move; show its latest
  const byBarcode = new Map()
  rows.forEach(row => byBarcode.set(barcodeValue(row), row))
  return [...byBarcode.values()]
}

const focusFirstInput = () => {
  nextTick(() => {
    if (!currentDestination.value) {
      destinationInput.value?.focus()
    } else {
      containerInput.value?.focus()
    }
  })
}

// Watch for barcode scans
watch(compiledBarCode, (barcode) => {
  if (!barcode || job.value?.status !== 'Running') {
    return
  }

  if (!currentDestination.value) {
    destinationBarcodeInput.value = barcode
    scanDestination()
  } else {
    containerBarcodeInput.value = barcode
    scanContainer()
  }
})

// Initialize
onMounted(async () => {
  const jobId = route.params.jobId
  if (jobId) {
    const saved = await readSavedState(jobId)

    // Same rule as Direct to Shelf: offline, or with moves still waiting to sync, the
    // server doesn't have the full picture yet, so reopen from the saved copy.
    if ((appIsOffline.value || appPendingSync.value) && saved) {
      loadState(saved)
      focusFirstInput()
      return
    }

    try {
      appIsLoadingData.value = true
      await getShelvingJob(jobId)

      const serverContainers = shelvingJob.value?.shelving_job_containers || []
      containers.value = mapServerContainers(serverContainers)

      // Scans saved by the older version of this page that were never sent
      const neverSent = (saved?.containers || []).filter(c =>
        !c.scanned_for_transfer && !containers.value.some(row => barcodeValue(row) === barcodeValue(c))
      )
      containers.value.push(...neverSent)

      if (saved?.destination) {
        // The saved copy knows the destination currently in use
        restoreDestination(saved)
      } else if (serverContainers.length > 0) {
        // Infer destination from first container for resumed/completed jobs
        const first = serverContainers[0]
        if (moveType.value === 'tray-item') {
          if (first.destination_tray) {
            currentDestination.value = first.destination_tray.barcode?.value
            destinationOwner.value = first.destination_tray.owner?.name
            destinationSizeClass.value = first.destination_tray.size_class?.name
          }
        } else {
          if (first.actual_shelf_position) {
            currentDestination.value = first.actual_shelf_position.shelf.barcode?.value
            currentDestinationLocation.value = first.actual_shelf_position.shelf.location // Assumption: shelf object has location from API
            destinationOwner.value = first.actual_shelf_position.shelf.owner?.name
            // We don't have shelf size class directly in the nested schema yet, but owner is good
          }
        }
      }
    } catch (error) {
      // The request can fail before the 'offline' event fires; use the saved copy if there is one
      if (saved) {
        loadState(saved)
      } else {
        notify({
          type: 'negative',
          message: 'Failed to load move job'
        })
        router.push({ name: 'shelving' })
        return
      }
    } finally {
      appIsLoadingData.value = false
    }

    // Keep the saved copy in step with the server
    saveState()
  }

  focusFirstInput()
})
</script>


