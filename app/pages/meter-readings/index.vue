<script setup lang="ts">
import { useKosStore } from '~/stores/kos'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

// Check authentication
const { data: authData, error } = await useFetch('/api/auth/me')
if (error.value || !authData.value) {
  await navigateTo('/login')
}

const currentUser = computed(() => authData.value?.user)
const kosStore = useKosStore()
const toast = useToast()

// Date formatter for period display
const df = new DateFormatter('id-ID', { month: 'long', year: 'numeric' })

// Number formatter - use consistent formatting for SSR and client
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

// Fetch properties
const { data: propertiesData } = await useFetch('/api/properties')
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

// Fetch rooms and properties
const { data: roomsData, refresh: refreshRooms } = await useFetch('/api/rooms', {
  query: { pageSize: 1000 }
})

const rooms = computed(() => roomsData.value?.data || [])

// Fetch all meter readings
const { data: allReadings, refresh: refreshReadings } = await useFetch('/api/meter-readings')

// Get latest reading per room
const latestReadingByRoom = computed(() => {
  const map = new Map()
  const readings = allReadings.value || []
  
  readings.forEach((r: any) => {
    const existing = map.get(r.roomId)
    if (!existing || r.period > existing.period) {
      map.set(r.roomId, r)
    }
  })
  
  return map
})

// Combine rooms with their latest meter readings
const roomsWithMeter = computed(() => {
  return rooms.value.map((room: any) => {
    const reading = latestReadingByRoom.value.get(room.id)
    return {
      ...room,
      lastMeterEnd: reading?.meterEnd || null,
      lastPeriod: reading?.period || null,
      lastRecordedAt: reading?.recordedAt || null
    }
  })
})

// Current period (YYYY-MM)
const currentPeriod = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

// Filtered rooms (by property, search, and recording status)
const filteredRooms = computed(() => {
  let result = roomsWithMeter.value
  
  // Filter by property
  if (selectedPropertyId.value !== '__all__') {
    result = result.filter((room: any) => room.propertyId === selectedPropertyId.value)
  }
  
  // Filter by recording status
  if (recordingStatus.value === 'recorded') {
    result = result.filter((room: any) => room.lastPeriod === currentPeriod.value)
  } else if (recordingStatus.value === 'unrecorded') {
    result = result.filter((room: any) => room.lastPeriod !== currentPeriod.value)
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((room: any) => 
      room.name.toLowerCase().includes(query) ||
      room.property?.name?.toLowerCase().includes(query)
    )
  }
  
  return result
})

// Pagination computed (for desktop table)
const totalItems = computed(() => filteredRooms.value.length)
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize))
const paginatedRooms = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredRooms.value.slice(start, end)
})

// Mobile Load More pagination (like reminders page)
const mobileLimit = ref(10)
const loadingMore = ref(false)

const mobileRooms = computed(() => {
  return filteredRooms.value.slice(0, mobileLimit.value)
})

const hasMoreRooms = computed(() => mobileLimit.value < filteredRooms.value.length)
const canShowLess = computed(() => mobileLimit.value > 10)

const loadMore = async () => {
  loadingMore.value = true
  await new Promise(resolve => setTimeout(resolve, 300))
  mobileLimit.value += 10
  loadingMore.value = false
}

const showLess = () => {
  mobileLimit.value = 10
}

// Reset page/limit when filter changes
watch([selectedPropertyId, searchQuery, recordingStatus], () => {
  currentPage.value = 1
  mobileLimit.value = 10
})

// Stats computed - based on all rooms (only filtered by property, not by recording status)
const statsFiltered = computed(() => {
  let result = roomsWithMeter.value
  
  // Only apply property filter for stats
  if (selectedPropertyId.value !== '__all__') {
    result = result.filter((room: any) => room.propertyId === selectedPropertyId.value)
  }
  
  return {
    total: result.length,
    recorded: result.filter((r: any) => r.lastPeriod === currentPeriod.value).length,
    pending: result.filter((r: any) => r.lastPeriod !== currentPeriod.value).length
  }
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

// Calendar date for period display (read-only, locked to current month)
const periodDate = computed(() => {
  const [year, month] = form.period.split('-').map(Number)
  return new CalendarDate(year, month, 1)
})

// Formatted period display
const formattedPeriod = computed(() => {
  return df.format(periodDate.value.toDate(getLocalTimeZone()))
})

// Computed usage
const usage = computed(() => {
  return Math.max(0, form.meterEnd - form.meterStart)
})

// Open modal to record meter
function openMeterModal(room: any) {
  selectedRoom.value = room
  form.period = currentPeriod.value
  form.meterStart = room.lastMeterEnd || 0
  form.meterEnd = room.lastMeterEnd || 0
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
    await $fetch('/api/meter-readings', {
      method: 'POST',
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
    await refreshReadings()
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

// Format date
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
        <div class="text-3xl font-bold">{{ statsFiltered.total }}</div>
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
          {{ statsFiltered.recorded }}
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
          {{ statsFiltered.pending }}
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
        
        <div class="overflow-x-auto">
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
                      :color="room.lastPeriod === currentPeriod ? 'success' : 'neutral'"
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
                    icon="i-heroicons-bolt"
                    color="primary"
                    variant="soft"
                    size="sm"
                    @click="openMeterModal(room)"
                  >
                    Catat Meter
                  </UButton>
                </td>
              </tr>
              <tr v-if="paginatedRooms.length === 0">
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
              :page="currentPage" 
              :total="totalItems" 
              :items-per-page="pageSize"
              @update:page="(p) => currentPage = p"
            />
          </div>
        </template>
      </UCard>
    </div>

    <!-- Mobile Card View (like reminders page) -->
    <div class="md:hidden">
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden">
        <div 
          v-for="room in mobileRooms" 
          :key="room.id"
          class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ room.name }}</h4>
              <p class="text-sm text-gray-500 truncate">{{ room.property?.name || '-' }}</p>
              <div class="mt-1 flex items-center gap-2 flex-wrap">
                <UBadge 
                  :color="room.lastPeriod === currentPeriod ? 'success' : 'warning'" 
                  variant="subtle" 
                  size="xs"
                >
                  {{ room.lastPeriod === currentPeriod ? 'Sudah dicatat' : 'Belum dicatat' }}
                </UBadge>
                <span v-if="room.lastMeterEnd !== null" class="text-xs text-gray-400">
                  {{ formatNumber(room.lastMeterEnd) }} kWh
                </span>
              </div>
            </div>
            
            <div class="shrink-0">
              <UButton
                icon="i-heroicons-bolt"
                color="primary"
                variant="soft"
                size="sm"
                @click="openMeterModal(room)"
              />
            </div>
          </div>
        </div>
        
        <!-- Loading Skeleton -->
        <div v-if="loadingMore" class="p-4 space-y-3">
          <div class="animate-pulse flex items-center gap-3">
            <div class="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
        
        <div v-if="mobileRooms.length === 0 && !loadingMore" class="p-8 text-center text-gray-500">
          Tidak ada kamar ditemukan
        </div>
        
        <!-- Load More / Show Less -->
        <div v-if="(hasMoreRooms || canShowLess) && !loadingMore" class="p-2 bg-gray-50 dark:bg-gray-800/30 flex justify-center gap-4">
          <span 
            v-if="hasMoreRooms"
            class="text-sm text-primary-600 dark:text-primary-400 font-medium select-none cursor-pointer hover:underline"
            @click="loadMore"
          >
            Lebih Banyak
          </span>
          <span 
            v-if="canShowLess"
            class="text-sm text-gray-500 dark:text-gray-400 font-medium select-none cursor-pointer hover:underline"
            @click="showLess"
          >
            Tampilkan Lebih Sedikit
          </span>
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

