<script setup lang="ts">
import DatePicker from "~/components/DatePicker.vue";
import ConfirmDialog from "~/components/ConfirmDialog.vue";
// No client middleware needed - API endpoints handle auth

const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

// State
const loading = ref(true)
const logs = ref<any[]>([])
const pagination = ref({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
})

// Filters
const filters = reactive({
  level: 'all',
  method: 'all',
  search: '',
})
const startDate = ref<Date | undefined>()
const endDate = ref<Date | undefined>()

// Settings
const settings = reactive({
  retentionDays: 7,
  loading: false,
})

// Purge state
const purging = ref(false)

// Level options for filter
const levelOptions = [
  { label: 'All Levels', value: 'all' },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
]

const methodOptions = [
  { label: 'All Methods', value: 'all' },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
]

// Fetch logs
async function fetchLogs() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(pagination.value.page),
      limit: String(pagination.value.limit),
    })
    
    if (filters.level && filters.level !== 'all') params.append('level', filters.level)
    if (filters.method && filters.method !== 'all') params.append('method', filters.method)
    if (filters.search) params.append('search', filters.search)
    if (startDate.value) params.append('startDate', startDate.value.toISOString().split('T')[0])
    if (endDate.value) params.append('endDate', endDate.value.toISOString().split('T')[0])
    
    const response = await $fetch(`/api/logs?${params.toString()}`)
    logs.value = response.logs
    pagination.value = response.pagination
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to fetch logs', color: 'error' })
  } finally {
    loading.value = false
  }
}

// Fetch settings
async function fetchSettings() {
  try {
    const response = await $fetch('/api/logs/settings')
    settings.retentionDays = response.retentionDays
  } catch (error) {
    console.error('Failed to fetch log settings')
  }
}

// Save settings
async function saveSettings() {
  settings.loading = true
  try {
    await $fetch('/api/logs/settings', {
      method: 'PUT',
      body: { retentionDays: settings.retentionDays },
    })
    toast.add({ title: 'Saved', description: 'Log retention settings updated', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to save settings', color: 'error' })
  } finally {
    settings.loading = false
  }
}

// Purge logs
async function purgeLogs() {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Purge Old Logs?',
    message: `Are you sure you want to delete logs older than ${settings.retentionDays} days? This action cannot be undone.`,
    confirmText: 'Yes, Purge',
    confirmColor: 'error'
  })
  
  if (!confirmed) return
  
  purging.value = true
  try {
    const response = await $fetch('/api/logs/purge', {
      method: 'POST',
      body: { retentionDays: settings.retentionDays },
    })
    toast.add({ 
      title: 'Purge Complete', 
      description: `Deleted ${response.purgedCount} log entries`,
      color: 'success' 
    })
    fetchLogs()
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to purge logs', color: 'error' })
  } finally {
    purging.value = false
  }
}

// Apply filters
function applyFilters() {
  pagination.value.page = 1
  fetchLogs()
}

// Reset filters
function resetFilters() {
  filters.level = 'all'
  filters.method = 'all'
  filters.search = ''
  startDate.value = undefined
  endDate.value = undefined
  pagination.value.page = 1
  fetchLogs()
}

// Format date
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Level badge color
function getLevelColor(level: string) {
  switch (level) {
    case 'debug': return 'neutral'
    case 'info': return 'info'
    case 'warn': return 'warning'
    case 'error': return 'error'
    default: return 'neutral'
  }
}

// Status badge color
function getStatusColor(statusCode: number | null) {
  if (!statusCode) return 'neutral'
  if (statusCode >= 500) return 'error'
  if (statusCode >= 400) return 'warning'
  if (statusCode >= 300) return 'info'
  return 'success'
}

// Initialize
onMounted(() => {
  fetchLogs()
  fetchSettings()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">System Logs</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">View and manage application logs.</p>
      </div>
      <UButton to="/settings" variant="ghost" icon="i-heroicons-arrow-left">
        Back to Settings
      </UButton>
    </div>

    <!-- Settings Card -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Log Retention</h2>
        </div>
      </template>
      
      <div class="flex flex-wrap items-end gap-4">
        <UFormField label="Retention Days" class="w-32">
          <UInput v-model="settings.retentionDays" type="number" min="1" max="365" class="w-full"/>
        </UFormField>
        
        <UButton 
          color="primary" 
          :loading="settings.loading" 
          @click="saveSettings"
        >
          Save
        </UButton>
        
        <UButton 
          color="error" 
          variant="soft"
          :loading="purging"
          icon="i-heroicons-trash"
          @click="purgeLogs"
        >
          Purge Old Logs
        </UButton>
        
        <div class="text-sm text-gray-500 ml-auto">
          Total logs: {{ pagination.total.toLocaleString() }}
        </div>
      </div>
    </UCard>

    <!-- Filters -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Filters</h2>
      </template>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <UFormField label="Level">
          <USelect v-model="filters.level" :items="levelOptions" value-key="value" class="w-full" />
        </UFormField>
        
        <UFormField label="Method">
          <USelect v-model="filters.method" :items="methodOptions" value-key="value" class="w-full" />
        </UFormField>
        
        <UFormField label="Search">
          <UInput v-model="filters.search" placeholder="Path or message..." class="w-full" />
        </UFormField>
        
        <UFormField label="Start Date">
          <DatePicker v-model="startDate" granularity="day" class="w-full" />
        </UFormField>
        
        <UFormField label="End Date">
          <DatePicker v-model="endDate" granularity="day" class="w-full" />
        </UFormField>
      </div>
      
      <div class="flex gap-2 mt-4">
        <UButton color="primary" @click="applyFilters">Apply Filters</UButton>
        <UButton variant="ghost" @click="resetFilters">Reset</UButton>
      </div>
    </UCard>

    <!-- Logs Table -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Log Entries</h2>
          <UButton variant="ghost" icon="i-heroicons-arrow-path" @click="fetchLogs" :loading="loading">
            Refresh
          </UButton>
        </div>
      </template>
      
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th class="text-left py-3 px-2 font-medium">Time</th>
              <th class="text-left py-3 px-2 font-medium">Level</th>
              <th class="text-left py-3 px-2 font-medium">Method</th>
              <th class="text-left py-3 px-2 font-medium">Path</th>
              <th class="text-left py-3 px-2 font-medium">Status</th>
              <th class="text-left py-3 px-2 font-medium">Duration</th>
              <th class="text-left py-3 px-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="log in logs" 
              :key="log.id"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <td class="py-3 px-2 whitespace-nowrap text-gray-500">
                {{ formatDate(log.createdAt) }}
              </td>
              <td class="py-3 px-2">
                <UBadge :color="getLevelColor(log.level)" size="sm">
                  {{ log.level }}
                </UBadge>
              </td>
              <td class="py-3 px-2 font-mono text-xs">
                {{ log.method || '-' }}
              </td>
              <td class="py-3 px-2 max-w-xs truncate font-mono text-xs" :title="log.path">
                {{ log.path || log.message }}
              </td>
              <td class="py-3 px-2">
                <UBadge v-if="log.statusCode" :color="getStatusColor(log.statusCode)" size="sm">
                  {{ log.statusCode }}
                </UBadge>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="py-3 px-2 text-gray-500">
                {{ log.duration ? `${log.duration}ms` : '-' }}
              </td>
              <td class="py-3 px-2 text-gray-500 text-xs font-mono">
                {{ log.ip || '-' }}
              </td>
            </tr>
            
            <tr v-if="logs.length === 0 && !loading">
              <td colspan="7" class="py-8 text-center text-gray-500">
                No logs found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <span class="text-sm text-gray-500">
          Showing {{ ((pagination.page - 1) * pagination.limit) + 1 }} - 
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }} 
          of {{ pagination.total }}
        </span>
        <UPagination
          :page="pagination.page"
          :items-per-page="pagination.limit"
          :total="pagination.total"
          @update:page="(p) => { pagination.page = p; fetchLogs(); }"
        />
      </div>
    </UCard>
  </div>
  
  <ConfirmDialog ref="confirmDialog" />
</template>
