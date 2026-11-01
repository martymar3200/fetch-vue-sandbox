<template>
  <q-page
    :style-fn="handlePageOffset"
    :padding="!route.params.jobId"
    class="picklist"
  >
    <LoadingOverlay />

    <template v-if="!pageInitLoading">
      <PicklistDashboard v-if="!route.params.jobId" />
      <PicklistExecute v-else-if="route.params.jobId" />
    </template>
  </q-page>
</template>

<script setup>
import { inject, onMounted, onBeforeMount } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePicklistStore } from '@/stores/picklist-store'
import { useGlobalStore } from '@/stores/global-store'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import PicklistDashboard from '@/components/Picklist/PicklistDashboard.vue'
import PicklistExecute from '@/components/Picklist/PicklistExecute.vue'

const route = useRoute()

// Store Data
const { getPicklistJob } = usePicklistStore()
const { pageInitLoading } = storeToRefs(useGlobalStore())

// Logic
const handlePageOffset = inject('handle-page-offset')

onBeforeMount(() => {
  pageInitLoading.value = true
})

onMounted( async () => {
  // if there is an id in the url we need to load that picklist job
  if (route.params.jobId) {
    await getPicklistJob(route.params.jobId)
  }
  pageInitLoading.value = false
})
</script>

<style lang="scss" scoped>
</style>
