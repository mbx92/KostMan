<script setup lang="ts">
import { useKosStore } from '~/stores/kos'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

// Get current user info (auth already verified by middleware)
const { data: authData } = await useAuthFetch('/api/auth/me')

const currentUser = computed(() => authData.value?.user)
const kosStore = useKosStore()
const toast = useToast()

// Date formatter for period display
const df = new DateFormatter('id-ID', { month: 'long', year: 'numeric' })

// Number formatter
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

// Fetch properties for filter
const { data: propertiesData } = await useAuthFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])
const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: '__all__' },
  ...properties.value.map((p: any) => ({ label: p.name, value: p.id }))
])

// Filter state
const selectedPropertyId = ref('__all__')
const searchQuery = ref('')
const recordingStatus = ref('all') // 'all', 'recorded', 'unrecorded'

// Pagination state
const currentPage = ref(1)
const pageSize = 10

// Current period (YYYY-MM)
const currentPeriod = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

// --- Server Side Data Fetching ---

// 1. Fetch Stats
const { data: statsData, refresh: refreshStats } = await useAuthFetch('/api/meter-readings/stats', {
  query: computed(() => ({
    propertyId: selectedPropertyId.value,
    period: currentPeriod.value
  }))
})

// 2. Fetch Rooms (Paginated)
const { data: roomsData, refresh: refreshRooms, pending: isLoading } = await useAuthFetch('/api/meter-readings/rooms', {
  query: computed(() => ({
    page: currentPage.value,
    pageSize: pageSize,
    propertyId: selectedPropertyId.value,
    status: recordingStatus.value,
    search: searchQuery.value, // Make sure search is reactive
    period: currentPeriod.value
  })),
  watch: [currentPage, selectedPropertyId, recordingStatus, searchQuery] 
})

const paginatedRooms = computed(() => roomsData.value?.data || [])
const totalItems = computed(() => roomsData.value?.meta?.total || 0)
const totalPages = computed(() => roomsData.value?.meta?.totalPages || 0)

// Reset page when filters change
watch([selectedPropertyId, recordingStatus, searchQuery], () => {
  currentPage.value = 1
})

// Modal state
const showModal = ref(false)
const selectedRoom = ref<any>(null)
const isSubmitting = ref(false)

// Form data
const form = reactive({
  period: currentPeriod.value,
  meterStart: 0,
  meterEnd: 0
})

// Calendar date for period display
const periodDate = computed(() => {
  const [year, month] = form.period.split('-').map(Number)
  return new CalendarDate(year, month, 1)
})

const formattedPeriod = computed(() => {
  return df.format(periodDate.value.toDate(getLocalTimeZone()))
})

// Computed usage
const usage = computed(() => {
  return Math.max(0, form.meterEnd - form.meterStart)
})

// Open modal to record meter
// Open modal to record meter
function openMeterModal(room: any) {
  selectedRoom.value = room
  form.period = currentPeriod.value

  // Check if we are editing an existing record for the CURRENT period
  if (room.currentPeriodStatus === 'recorded' && room.lastPeriod === currentPeriod.value) {
     // If editing, use the existing values (Need to fetch StartMeter too ideally, 
     // but 'lastMeterEnd' in the listing is actually the 'meterEnd' of the record).
     // Wait, the API 'rooms.get.ts' only provided 'lastMeterEnd'. 
     // We need to fetch the reading details or rely on 'lastMeterEnd' being the 'Current End' 
     // and 'lastMeterStart'?
     // Actually, looking at 'rooms.get.ts', we map 'lastMeterEnd' from the latest reading.
     // But we don't have 'meterStart' in the payload. We should fix rooms.get.ts to return meterStart too.
     // For now, let's assume we can get it, or we fetch it.
     // Better strategy: Let's assume we need to fix rooms.get.ts first to return meterStart.
     // Reverting this thought: I will first update rooms.get.ts to include meterStart.
     // BUT, proceed with UI change assuming properties will exist.
     
     form.meterStart = room.lastMeterStart || 0 
     form.meterEnd = room.lastMeterEnd || 0
  } else {
     // If new, start from the previous month's end (which is 'lastMeterEnd' if exists)
     // BUT, 'lastMeterEnd' in room object is the *latest* reading found.
     // If status is 'unrecorded', 'lastMeterEnd' is from PREVIOUS month.
     form.meterStart = room.lastMeterEnd || 0
     form.meterEnd = room.lastMeterEnd || 0
  }
  
  showModal.value = true
}

// Submit meter reading
async function submitMeterReading() {
  if (!selectedRoom.value) return
  
  if (form.meterEnd < form.meterStart) {
    toast.add({
      title: 'Error',
      description: 'Meter akhir tidak boleh kurang dari meter awal',
      color: 'error'
    })
    return
  }
  
  isSubmitting.value = true
  try {
    // Use PUT to allow Upsert (Update if exists, Insert if new)
    await $fetch('/api/meter-readings', {
      method: 'PUT',
      body: {
        roomId: selectedRoom.value.id,
        period: form.period,
        meterStart: form.meterStart,
        meterEnd: form.meterEnd
      }
    })
    
    toast.add({
      title: 'Berhasil',
      description: `Meter reading untuk ${selectedRoom.value.name} berhasil dicatat`,
      color: 'success'
    })
    
    showModal.value = false
    // Refresh data
    await refreshRooms()
    await refreshStats()
  } catch (err: any) {
    toast.add({
      title: 'Gagal',
      description: err?.data?.message || 'Gagal menyimpan meter reading',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Catat Meter Listrik</h1>
      <p class="text-gray-600 dark:text-gray-400">Catat pembacaan kWh meter untuk setiap kamar.</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-home" class="w-5 h-5 text-blue-500" />
            <span class="font-semibold">Total Kamar</span>
          </div>
        </template>
        <div class="text-3xl font-bold">{{ statsData?.total || 0 }}</div>
        <p v-if="selectedPropertyId !== '__all__'" class="text-sm text-gray-500">Properti terpilih</p>
      </UCard>
      
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-yellow-500" />
            <span class="font-semibold">Sudah Dicatat</span>
          </div>
        </template>
        <div class="text-3xl font-bold text-green-600 dark:text-green-400">
          {{ statsData?.recorded || 0 }}
        </div>
        <p class="text-sm text-gray-500">Periode {{ currentPeriod }}</p>
      </UCard>
      
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-clock" class="w-5 h-5 text-orange-500" />
            <span class="font-semibold">Belum Dicatat</span>
          </div>
        </template>
        <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">
          {{ statsData?.pending || 0 }}
        </div>
        <p class="text-sm text-gray-500">Periode {{ currentPeriod }}</p>
      </UCard>
    </div>

    <!-- Filter Card (below stats) -->
    <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
      <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <UInput
          v-model="searchQuery"
          placeholder="Cari nama kamar..."
          icon="i-heroicons-magnifying-glass"
          class="w-full sm:w-64"
          :debounce="500"
        />
        <USelect 
          v-model="selectedPropertyId" 
          :items="propertyOptions" 
          value-key="value" 
          label-key="label"
          class="w-full sm:w-48"
        />
        <USelect 
          v-model="recordingStatus" 
          :items="[
            { label: 'Semua Status', value: 'all' },
            { label: 'Sudah Dicatat', value: 'recorded' },
            { label: 'Belum Dicatat', value: 'unrecorded' }
          ]" 
          value-key="value" 
          label-key="label"
          class="w-full sm:w-48"
        />
        <span v-if="totalItems > 0" class="text-sm text-gray-500 sm:ml-auto text-center sm:text-right">
          {{ totalItems }} kamar
        </span>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="hidden md:block">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Daftar Kamar</h3>
            <span v-if="totalPages > 1" class="text-sm text-gray-500">
              Halaman {{ currentPage }} dari {{ totalPages }}
            </span>
          </div>
        </template>
        
        <div class="overflow-x-auto relative">
           <div v-if="isLoading" class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10">
             <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
           </div>

          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Kamar</th>
                <th class="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Properti</th>
                <th class="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th class="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Meter Terakhir</th>
                <th class="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Periode Terakhir</th>
                <th class="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="room in paginatedRooms" 
                :key="room.id"
                class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="py-3 px-4">
                  <div class="font-medium text-gray-900 dark:text-white">{{ room.name }}</div>
                  <div v-if="room.tenantName" class="text-sm text-gray-500">{{ room.tenantName }}</div>
                </td>
                <td class="py-3 px-4 text-gray-600 dark:text-gray-400">
                  {{ room.property?.name || '-' }}
                </td>
                <td class="py-3 px-4">
                  <UBadge 
                     :color="room.status === 'occupied' ? 'success' : room.status === 'available' ? 'info' : 'warning'"
                     variant="soft"
                  >
                     {{ room.status === 'occupied' ? 'Terisi' : room.status === 'available' ? 'Tersedia' : 'Maintenance' }}
                  </UBadge>
                </td>
                <td class="py-3 px-4">
                  <span v-if="room.lastMeterEnd !== null" class="font-mono text-lg">
                    {{ formatNumber(room.lastMeterEnd) }} kWh
                  </span>
                  <span v-else class="text-gray-400">Belum ada data</span>
                </td>
                <td class="py-3 px-4">
                  <div v-if="room.lastPeriod">
                    <UBadge 
                      :color="room.currentPeriodStatus === 'recorded' ? 'success' : 'neutral'"
                      variant="soft"
                    >
                      {{ room.lastPeriod }}
                    </UBadge>
                    <div class="text-xs text-gray-500 mt-1">{{ formatDate(room.lastRecordedAt) }}</div>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <UButton
                    :color="room.currentPeriodStatus === 'recorded' ? 'neutral' : 'primary'"
                    :variant="room.currentPeriodStatus === 'recorded' ? 'ghost' : 'soft'"
                    icon="i-heroicons-bolt"
                    size="sm"
                    @click="openMeterModal(room)"
                  >
                    {{ room.currentPeriodStatus === 'recorded' ? 'Ubah' : 'Catat Meter' }}
                  </UButton>
                </td>
              </tr>
              <tr v-if="!isLoading && paginatedRooms.length === 0">
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Tidak ada kamar ditemukan
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <template v-if="totalPages > 1" #footer>
          <div class="flex justify-center">
            <UPagination 
              v-model:page="currentPage" 
              :total="totalItems" 
              :items-per-page="pageSize"
            />
          </div>
        </template>
      </UCard>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden">
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden min-h-[300px] relative">
        <!-- Loading Overlay -->
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10">
             <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
        </div>

        <div 
          v-for="room in paginatedRooms" 
          :key="room.id"
          class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ room.name }}</h4>
              <p class="text-sm text-gray-500 truncate">{{ room.property?.name || '-' }}</p>
              <div class="mt-1 flex items-center gap-2 flex-wrap">
                <UBadge 
                  :color="room.currentPeriodStatus === 'recorded' ? 'success' : 'warning'" 
                  variant="subtle" 
                  size="xs"
                >
                  {{ room.currentPeriodStatus === 'recorded' ? 'Sudah dicatat' : 'Belum dicatat' }}
                </UBadge>
                <span v-if="room.lastMeterEnd !== null" class="text-xs text-gray-400">
                  {{ formatNumber(room.lastMeterEnd) }} kWh
                </span>
              </div>
            </div>
            
            <div class="shrink-0">
               <UButton
                :color="room.currentPeriodStatus === 'recorded' ? 'neutral' : 'primary'"
                :variant="room.currentPeriodStatus === 'recorded' ? 'ghost' : 'soft'"
                icon="i-heroicons-bolt"
                size="sm"
                @click="openMeterModal(room)"
              />
            </div>
          </div>
        </div>
        
        <div v-if="!isLoading && paginatedRooms.length === 0" class="p-8 text-center text-gray-500">
          Tidak ada kamar ditemukan
        </div>
        
        <!-- Mobile Pagination -->
        <div v-if="totalPages > 1" class="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-center">
            <UPagination 
              v-model:page="currentPage" 
              :total="totalItems" 
              :items-per-page="pageSize"
              :max="5"
            />
        </div>
      </div>
    </div>

    <!-- Meter Recording Modal -->
    <UModal v-model:open="showModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold">Catat Meter Listrik</h3>
                <p v-if="selectedRoom" class="text-sm text-gray-500">
                  {{ selectedRoom.name }} - {{ selectedRoom.property?.name }}
                </p>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                @click="showModal = false"
              />
            </div>
          </template>
          
          <div class="space-y-4">
            <!-- Period Display (locked to current month) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Periode
              </label>
              <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <UIcon name="i-heroicons-calendar" class="w-5 h-5 text-gray-500" />
                <span class="font-medium">{{ formattedPeriod }}</span>
                <UBadge color="info" variant="subtle" size="xs" class="ml-auto">Bulan Ini</UBadge>
              </div>
              <p class="text-xs text-gray-500 mt-1">Catatan meter hanya bisa dilakukan untuk periode bulan ini.</p>
            </div>
            
            <!-- Meter Start & End in one row -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meter Awal (kWh)
                </label>
                <UInput
                  v-model.number="form.meterStart"
                  type="number"
                  size="lg"
                  :min="0"
                  placeholder="0"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meter Akhir (kWh)
                </label>
                <UInput
                  v-model.number="form.meterEnd"
                  type="number"
                  size="lg"
                  :min="form.meterStart"
                  placeholder="0"
                />
              </div>
            </div>
            
            <!-- Usage Preview -->
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">Penggunaan Listrik</div>
                  <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {{ formatNumber(usage) }} kWh
                  </div>
                </div>
                <UIcon name="i-heroicons-bolt" class="w-10 h-10 text-yellow-500" />
              </div>
            </div>
          </div>
          
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton
                color="neutral"
                variant="ghost"
                @click="showModal = false"
              >
                Batal
              </UButton>
              <UButton
                color="primary"
                :loading="isSubmitting"
                @click="submitMeterReading"
              >
                Simpan
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

