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
const occupancyFilter = ref<'all' | 'occupied'>('occupied')

// Groupings
const collapsedGroups = ref<Set<string>>(new Set())

const toggleGroup = (propertyId: string) => {
  const newSet = new Set(collapsedGroups.value)
  if (newSet.has(propertyId)) {
    newSet.delete(propertyId)
  } else {
    newSet.add(propertyId)
  }
  collapsedGroups.value = newSet
}

const isGroupCollapsed = (propertyId: string) => {
  return collapsedGroups.value.has(propertyId)
}

// Pagination state (Removed to fetch all)

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

// 2. Fetch Rooms (All)
const { data: roomsData, refresh: refreshRooms, pending: isLoading } = await useAuthFetch('/api/meter-readings/rooms', {
  query: computed(() => ({
    all: true,
    propertyId: selectedPropertyId.value,
    occupancy: occupancyFilter.value,
    search: searchQuery.value,
    period: currentPeriod.value
  })),
  watch: [selectedPropertyId, occupancyFilter, searchQuery] 
})

const paginatedRooms = computed(() => roomsData.value?.data || [])
const totalItems = computed(() => roomsData.value?.meta?.total || 0)
const totalPages = computed(() => roomsData.value?.meta?.totalPages || 0)

// Group rooms by property for the UI
const groupedRooms = computed(() => {
  const groups = new Map<string, any>()
  const NO_PROPERTY_KEY = '__no_property__'

  for (const room of paginatedRooms.value) {
    const propertyId = room.propertyId || NO_PROPERTY_KEY
    const propertyName = room.property?.name || 'Belum Ada Properti'

    if (!groups.has(propertyId)) {
      groups.set(propertyId, {
        propertyId,
        propertyName,
        rooms: []
      })
    }
    groups.get(propertyId)!.rooms.push(room)
  }

  const result = Array.from(groups.values())
  result.sort((a, b) => {
    if (a.propertyId === NO_PROPERTY_KEY) return 1
    if (b.propertyId === NO_PROPERTY_KEY) return -1
    return a.propertyName.localeCompare(b.propertyName)
  })

  return result
})

// Empty watcher since we don't have page to reset anymore

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

// Billing Info State
const isFetchingBills = ref(false)
const roomRentBills = ref<any[]>([])
const roomUtilityBills = ref<any[]>([])

const totalRentArrears = computed(() => {
  return roomRentBills.value
    .filter(row => !row.bill.isPaid)
    .reduce((sum, row) => sum + (row.bill.totalAmount - (row.bill.paidAmount || 0)), 0)
})

const totalUtilityArrears = computed(() => {
  return roomUtilityBills.value
    .filter(row => !row.bill.isPaid)
    .reduce((sum, row) => sum + (row.bill.totalAmount - (row.bill.paidAmount || 0)), 0)
})

// Convert YYYY-MM to Month YYYY (eg. 'Maret 2026')
const formatPeriodMonth = (periodStr?: string | null) => {
  if (!periodStr) return ''
  try {
    const [year, month] = periodStr.split('-').map(Number)
    const d = new Date(year, month - 1, 1)
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d)
  } catch(e) {
    return periodStr
  }
}

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
  
  // Fetch bills for this room and period
  fetchRoomBills(room.id, currentPeriod.value)
}

async function fetchRoomBills(roomId: string, period: string) {
  isFetchingBills.value = true
  roomRentBills.value = []
  roomUtilityBills.value = []
  
  try {
    const [rentData, utilityData] = await Promise.all([
      $fetch<any[]>('/api/rent-bills', { query: { roomId } }), // Fetch all rent bills for room
      $fetch<any[]>('/api/utility-bills', { query: { roomId, period } }) // Utility is strict to period
    ])
    
    if (rentData && rentData.length > 0) {
      // Sort rent bills descending by period, and pick the latest one
      rentData.sort((a, b) => {
         const pA = a.bill?.period || ''
         const pB = b.bill?.period || ''
         return pB.localeCompare(pA)
      })
      roomRentBills.value = [rentData[0]]
    } else {
      roomRentBills.value = []
    }
    
    roomUtilityBills.value = utilityData || []
  } catch(e) {
    console.error('Failed to fetch room bills', e)
  } finally {
    isFetchingBills.value = false
  }
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
    <div class="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
            <!-- Status Filter -->
            <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-full sm:w-auto">
              <UButton
                :color="occupancyFilter === 'occupied' ? 'primary' : 'neutral'"
                :variant="occupancyFilter === 'occupied' ? 'solid' : 'ghost'"
                size="sm"
                class="flex-1 sm:flex-none justify-center"
                @click="occupancyFilter = 'occupied'"
              >
                Status Terisi
              </UButton>
              <UButton
                :color="occupancyFilter === 'all' ? 'primary' : 'neutral'"
                :variant="occupancyFilter === 'all' ? 'solid' : 'ghost'"
                size="sm"
                class="flex-1 sm:flex-none justify-center"
                @click="occupancyFilter = 'all'"
              >
                Semua
              </UButton>
            </div>
        <span v-if="totalItems > 0" class="text-sm text-gray-500 sm:ml-auto text-center sm:text-right flex items-center">
          {{ totalItems }} kamar
        </span>
      </div>
    </div>

    <!-- Desktop Grouped View -->
    <div class="hidden md:block">
      <!-- Loading Overlay -->
      <div v-if="isLoading" class="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center p-10 h-64 border border-gray-200 dark:border-gray-800">
        <div class="flex flex-col items-center gap-2">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
          <span class="text-sm text-gray-600 dark:text-gray-400">Memuat data kamar...</span>
        </div>
      </div>
      
      <div v-else class="space-y-4">
        <div v-if="totalItems === 0" class="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
           <UIcon name="i-heroicons-bolt" class="w-16 h-16 text-gray-400 mb-4" />
           <h3 class="text-lg font-medium text-gray-900 dark:text-white">Tidak ada kamar ditemukan</h3>
           <p class="text-gray-500 dark:text-gray-400">Coba ubah filter atau kata kunci pencarian.</p>
        </div>
        
        <div 
          v-for="group in groupedRooms" 
          :key="group.propertyId"
          class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden mb-4"
        >
          <!-- Property Group Header -->
          <button 
            class="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-800"
            @click="toggleGroup(group.propertyId)"
          >
            <div class="flex items-center gap-3">
              <div class="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30">
                <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-primary-500" />
              </div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ group.propertyName }}</h2>
              <UBadge color="neutral" variant="subtle" size="xs">{{ group.rooms.length }} kamar</UBadge>
            </div>
            <UIcon 
              name="i-heroicons-chevron-down" 
              class="w-5 h-5 text-gray-400 transition-transform duration-200" 
              :class="{ '-rotate-90': isGroupCollapsed(group.propertyId) }"
            />
          </button>

          <!-- Group Table -->
          <div v-show="!isGroupCollapsed(group.propertyId)" class="overflow-x-auto relative">
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th class="text-left py-3 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Kamar</th>
                  <th class="text-left py-3 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Status</th>
                  <th class="text-left py-3 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Meter Terakhir</th>
                  <th class="text-left py-3 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Catatan Bulan Ini</th>
                  <th class="text-center py-3 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="room in group.rooms" 
                  :key="room.id"
                  class="border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors"
                >
                  <td class="py-3 px-5">
                    <div class="font-medium text-gray-900 dark:text-white">{{ room.name }}</div>
                    <div v-if="room.tenantName" class="text-sm text-gray-500">{{ room.tenantName }}</div>
                  </td>
                  <td class="py-3 px-5">
                    <UBadge 
                       :color="room.status === 'occupied' ? 'success' : room.status === 'available' ? 'info' : 'warning'"
                       variant="subtle"
                       size="xs"
                    >
                       {{ room.status === 'occupied' ? 'Terisi' : room.status === 'available' ? 'Tersedia' : 'Maintenance' }}
                    </UBadge>
                  </td>
                  <td class="py-3 px-5">
                    <span v-if="room.lastMeterEnd !== null" class="font-mono">
                      {{ formatNumber(room.lastMeterEnd) }} kWh
                    </span>
                    <span v-else class="text-gray-400 text-sm italic">Belum ada</span>
                    <div v-if="room.lastPeriod && room.currentPeriodStatus !== 'recorded'" class="text-xs text-gray-500 mt-0.5">
                       Periode: {{ room.lastPeriod }}
                    </div>
                  </td>
                  <td class="py-3 px-5">
                    <div v-if="room.currentPeriodStatus === 'recorded'">
                      <div class="flex items-center gap-1 text-success-600 dark:text-success-400 font-medium text-sm">
                         <UIcon name="i-heroicons-check-circle" class="w-4 h-4" /> 
                         Selesai ({{ currentPeriod }})
                      </div>
                      <div class="text-xs text-gray-500 mt-0.5">{{ formatDate(room.lastRecordedAt) }}</div>
                    </div>
                    <div v-else class="flex items-center gap-1 text-warning-600 dark:text-warning-500 font-medium text-sm">
                       <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" /> 
                       Belum Dicatat
                    </div>
                  </td>
                  <td class="py-3 px-5 text-center">
                    <UButton
                      v-if="room.status === 'occupied'"
                      :color="room.currentPeriodStatus === 'recorded' ? 'neutral' : 'primary'"
                      :variant="room.currentPeriodStatus === 'recorded' ? 'ghost' : 'soft'"
                      icon="i-heroicons-bolt"
                      size="sm"
                      @click="openMeterModal(room)"
                    >
                      {{ room.currentPeriodStatus === 'recorded' ? 'Ubah' : 'Catat Meter' }}
                    </UButton>
                    <span v-else class="text-xs text-gray-400 italic">Tidak wajib</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden">
      <!-- Loading Overlay -->
      <div v-if="isLoading" class="relative bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center p-10 h-64 border border-gray-200 dark:border-gray-800">
        <div class="flex flex-col items-center gap-2">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
          <span class="text-sm text-gray-600 dark:text-gray-400">Memuat data kamar...</span>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div v-if="totalItems === 0" class="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
           <UIcon name="i-heroicons-bolt" class="w-16 h-16 text-gray-400 mb-4" />
           <h3 class="text-lg font-medium text-gray-900 dark:text-white">Tidak ada kamar ditemukan</h3>
           <p class="text-gray-500 dark:text-gray-400">Coba ubah filter atau kata kunci pencarian.</p>
        </div>

        <div 
          v-for="group in groupedRooms" 
          :key="group.propertyId"
          class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden mb-4"
        >
          <!-- Property Group Header -->
          <button 
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-800"
            @click="toggleGroup(group.propertyId)"
          >
            <div class="flex items-center gap-3">
              <div class="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30">
                <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-primary-500" />
              </div>
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ group.propertyName }}</h2>
              <UBadge color="neutral" variant="subtle" size="xs">{{ group.rooms.length }}</UBadge>
            </div>
            <UIcon 
              name="i-heroicons-chevron-down" 
              class="w-5 h-5 text-gray-400 transition-transform duration-200" 
              :class="{ '-rotate-90': isGroupCollapsed(group.propertyId) }"
            />
          </button>

          <!-- Group List -->
          <div v-show="!isGroupCollapsed(group.propertyId)" class="divide-y divide-gray-100 dark:divide-gray-800">
            <div 
              v-for="room in group.rooms" 
              :key="room.id"
              class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                     <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ room.name }}</h4>
                     <UBadge 
                        :color="room.status === 'occupied' ? 'success' : room.status === 'available' ? 'info' : 'warning'"
                        variant="subtle"
                        size="xs"
                        class="px-1.5 py-0"
                     >
                        {{ room.status === 'occupied' ? 'Terisi' : room.status === 'available' ? 'Tersedia' : 'Maintenance' }}
                     </UBadge>
                  </div>
                  <div class="mt-1 flex items-center gap-2 flex-wrap">
                    <UBadge 
                      :color="room.currentPeriodStatus === 'recorded' ? 'success' : 'warning'" 
                      variant="subtle" 
                      size="xs"
                    >
                      {{ room.currentPeriodStatus === 'recorded' ? 'Sudah dicatat' : 'Belum dicatat' }}
                    </UBadge>
                    <span v-if="room.lastMeterEnd !== null" class="text-xs text-gray-500 font-mono">
                      {{ formatNumber(room.lastMeterEnd) }} kWh
                    </span>
                  </div>
                </div>
                
                <div class="shrink-0" v-if="room.status === 'occupied'">
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
          </div>
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

            <!-- Billing Summary -->
            <div class="border-t border-gray-200 dark:border-gray-800 pt-4 mt-6">
               <h4 class="font-medium text-gray-900 dark:text-white mb-3">Ringkasan Tagihan Terbit</h4>
               
               <div v-if="isFetchingBills" class="flex items-center gap-2 p-3 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
                 <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" /> Sedang memuat tagihan...
               </div>
               
               <div v-else class="space-y-3">
                 <!-- Rent Bill -->
                 <div class="flex justify-between items-start p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                   <div>
                     <div class="font-medium text-sm flex items-center gap-1.5">
                       Sewa Kamar
                     </div>
                     <div v-if="roomRentBills.length > 0" class="mt-1 flex items-center gap-2">
                       <span class="text-xs text-gray-500">{{ formatPeriodMonth(roomRentBills[0].bill.period) }}</span>
                       <UBadge :color="roomRentBills[0].bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                         {{ roomRentBills[0].bill.isPaid ? 'Lunas' : 'Belum Lunas' }}
                       </UBadge>
                     </div>
                     <div v-else class="text-xs text-gray-500 mt-1">Belum ada tagihan sewa</div>
                   </div>
                   <div class="text-right">
                     <div class="font-semibold text-gray-900 dark:text-white">
                         {{ roomRentBills.length > 0 ? `Rp ${formatNumber(roomRentBills[0].bill.totalAmount)}` : '-' }}
                     </div>
                   </div>
                 </div>

                 <!-- Utility Bill -->
                 <div class="flex justify-between items-start p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                   <div>
                     <div class="font-medium text-sm">Utilitas (Termasuk Listrik)</div>
                     <div v-if="roomUtilityBills.length > 0" class="mt-1 flex items-center gap-2">
                       <span class="text-xs text-gray-500">{{ formatPeriodMonth(roomUtilityBills[0].bill.period) }}</span>
                       <UBadge :color="roomUtilityBills[0].bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                         {{ roomUtilityBills[0].bill.isPaid ? 'Lunas' : 'Belum Lunas' }}
                       </UBadge>
                     </div>
                     <div v-else class="text-xs text-gray-500 mt-1">Belum ada tagihan utilitas</div>
                   </div>
                   <div class="text-right">
                     <div class="font-semibold text-gray-900 dark:text-white">
                         {{ roomUtilityBills.length > 0 ? `Rp ${formatNumber(roomUtilityBills[0].bill.totalAmount)}` : '-' }}
                     </div>
                   </div>
                 </div>
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

