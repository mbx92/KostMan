<script setup lang="ts">
import DatePicker from '~/components/DatePicker.vue'

const route = useRoute()
const router = useRouter()

// -- State --
const now = new Date()

// Helpers for dates
const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const getStartOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1)
const getEndOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31)

const formatDateToString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const presetRanges = [
  { label: 'Bulan Ini', getValue: () => [getStartOfMonth(new Date()), getEndOfMonth(new Date())] },
  { label: 'Bulan Lalu', getValue: () => {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return [getStartOfMonth(d), getEndOfMonth(d)]
  }},
  { label: 'Tahun Ini', getValue: () => [getStartOfYear(new Date()), getEndOfYear(new Date())] }
]

const startDate = ref(formatDateToString(getStartOfMonth(now)))
const endDate = ref(formatDateToString(getEndOfMonth(now)))
const selectedPropertyId = ref('all')
const groupBy = ref('month')

// Pagination state
const page = ref(1)
const limit = ref(10)

// -- Options --
const groupByOptions = [
    { label: 'Bulanan', value: 'month' },
    { label: 'Mingguan', value: 'week' },
    { label: 'Harian', value: 'day' }
]

// -- Fetch Properties --
const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])
const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

// -- Interfaces --
interface IncomeReportData {
  summary: {
    totalIncome: number
    rentIncome: number
    utilityIncome: number
    otherIncome: number
    averageMonthlyIncome: number
    growthRate: number
  }
  byPeriod: Array<{
    period: string
    rentIncome: number
    utilityIncome: number
    total: number
  }>
  byProperty: Array<{
    propertyId: string
    propertyName: string
    totalIncome: number
    rentIncome: number
    utilityIncome: number
    occupancyRate: number
    averageRentPerRoom: number
  }>
  topPerformingRooms: {
    data: Array<{
      roomId: string
      roomName: string
      propertyName: string
      totalPaid: number
      paymentsCount: number
    }>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

// -- State for report data --
const reportData = ref<IncomeReportData | null>(null)
const pending = ref(false)

// -- Fetch Report Function --
const fetchReport = async () => {
  pending.value = true
  try {
    const data = await $fetch<IncomeReportData>('/api/reports/income', {
      query: {
        startDate: startDate.value,
        endDate: endDate.value,
        propertyId: selectedPropertyId.value === 'all' ? undefined : selectedPropertyId.value,
        groupBy: groupBy.value
        // No page/limit - fetch all data
      }
    })
    reportData.value = data
    console.log('Report data fetched:', {
      totalRooms: data.topPerformingRooms?.data?.length,
      firstRoom: data.topPerformingRooms?.data?.[0]
    })
  } catch (error) {
    console.error('Error fetching report:', error)
  } finally {
    pending.value = false
  }
}

// Client-side pagination computed
const paginatedRooms = computed(() => {
  if (!reportData.value?.topPerformingRooms?.data) {
    console.log('No data available for pagination')
    return []
  }
  const start = (page.value - 1) * limit.value
  const end = start + limit.value
  const rooms = reportData.value.topPerformingRooms.data.slice(start, end)
  console.log(`Pagination: page ${page.value}, showing ${start}-${end}, total: ${reportData.value.topPerformingRooms.data.length}`)
  return rooms
})

const totalRooms = computed(() => {
  const total = reportData.value?.topPerformingRooms?.data?.length || 0
  console.log('Total rooms:', total)
  return total
})
const totalPages = computed(() => Math.ceil(totalRooms.value / limit.value))

// Setup watches and initial fetch on client-side after mount
onMounted(() => {
  // Initial fetch
  fetchReport()
  
  // Watch for filter changes
  watch([startDate, endDate, selectedPropertyId, groupBy], () => {
    page.value = 1 // Reset to page 1 when filters change
    fetchReport()
  })
})

// -- Actions --
const applyPreset = (range: { getValue: () => Date[] }) => {
    const [start, end] = range.getValue()
    startDate.value = formatDateToString(start)
    endDate.value = formatDateToString(end)
    // page will be reset by the filter watch above
}

const isPresetSelected = (range: { getValue: () => Date[] }) => {
    const [start, end] = range.getValue()
    return startDate.value === formatDateToString(start) && 
           endDate.value === formatDateToString(end)
}

// -- Helpers --
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatPercent = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`

// Max value for charts scaling
const maxIncome = computed(() => {
    if (!reportData.value?.byPeriod.length) return 100
    return Math.max(...reportData.value.byPeriod.map(p => p.total))
})

</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Laporan Pendapatan</h1>
        <p class="text-gray-500 dark:text-gray-400">Lacak pertumbuhan dan kinerja pendapatan</p>
      </div>

       <!-- Quick Filters -->
      <div class="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <UButton 
            v-for="preset in presetRanges" 
            :key="preset.label"
            size="xs"
            :color="isPresetSelected(preset) ? 'primary' : 'neutral'"
            :variant="isPresetSelected(preset) ? 'solid' : 'ghost'"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </UButton>
      </div>
    </div>
      
    <!-- Filters Bar -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 w-full">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Tanggal Mulai</label>
                 <DatePicker v-model="startDate" granularity="day" class="w-full" />
            </div>
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Tanggal Akhir</label>
                 <DatePicker v-model="endDate" granularity="day" class="w-full" />
            </div>
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Properti</label>
                 <USelect 
                    v-model="selectedPropertyId" 
                    :items="propertyOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                />
            </div>
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Kelompokkan</label>
                 <USelect 
                    v-model="groupBy" 
                    :items="groupByOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                />
            </div>
          </div>
      </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
           <div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
             <UIcon name="i-heroicons-currency-dollar" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pendapatan</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap">{{ formatCurrency(reportData?.summary.totalIncome || 0) }}</h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
             <UIcon name="i-heroicons-home" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Pendapatan Sewa</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap">{{ formatCurrency(reportData?.summary.rentIncome || 0) }}</h3>
           </div>
        </div>
      </div>

       <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
             <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-orange-600 dark:text-orange-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Pendapatan Listrik</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap">{{ formatCurrency(reportData?.summary.utilityIncome || 0) }}</h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 rounded-lg" :class="(reportData?.summary.growthRate || 0) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
             <UIcon name="i-heroicons-arrow-trending-up" class="w-6 h-6" 
                :class="(reportData?.summary.growthRate || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"/>
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Tingkat Pertumbuhan</p>
             <h3 class="text-xl font-bold mt-1 whitespace-nowrap" :class="(reportData?.summary.growthRate || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                 {{ formatPercent(reportData?.summary.growthRate || 0) }}
             </h3>
             <p class="text-xs text-gray-400 mt-1">vs periode sebelumnya</p>
           </div>
        </div>
      </div>
    </div>

    <!-- Charts Area -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Income Trend (Bar Chart) -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-6">Tren Pendapatan</h3>
             
             <!-- Simple CSS Chart -->
             <div class="h-64 flex items-end justify-between gap-2 overflow-x-auto pb-2">
                 <div v-for="item in reportData?.byPeriod" :key="item.period" class="h-full flex flex-col items-center gap-2 group min-w-[40px] flex-1">
                     
                     <div class="w-full bg-gray-100 dark:bg-gray-800 rounded-t-lg relative flex items-end justify-center overflow-hidden" 
                          :style="{ height: item.total > 0 ? `${Math.max(10, (item.total / (maxIncome || 1)) * 100)}%` : '8px' }">
                         <!-- Stacks -->
                         <div v-if="item.total > 0" class="w-full bg-blue-500/80 group-hover:bg-blue-500 transition-colors absolute bottom-0" 
                              :style="{ height: `${(item.rentIncome / item.total) * 100}%` }">
                         </div>
                         <div v-if="item.total > 0" class="w-full bg-orange-500/80 group-hover:bg-orange-500 transition-colors absolute top-0" 
                              :style="{ height: `${(item.utilityIncome / item.total) * 100}%`, bottom: `${(item.rentIncome / item.total) * 100}%` }">
                         </div>
                              
                         <!-- Tooltip -->
                         <div class="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-xs p-1.5 rounded pointer-events-none whitespace-nowrap z-10">
                             {{ formatCurrency(item.total) }}
                         </div>
                     </div>
                     <span class="text-xs text-gray-500 rotate-0 truncate max-w-full">{{ item.period }}</span>
                 </div>
                 <div v-if="!reportData?.byPeriod || reportData?.byPeriod.length === 0" class="w-full h-full flex items-center justify-center text-gray-400">
                     Tidak ada data tren
                 </div>
             </div>
             
             <div class="flex items-center justify-center gap-4 mt-4">
                 <div class="flex items-center gap-2 text-xs text-gray-500">
                     <span class="w-3 h-3 bg-blue-500 rounded-full"></span> Sewa
                 </div>
                 <div class="flex items-center gap-2 text-xs text-gray-500">
                     <span class="w-3 h-3 bg-orange-500 rounded-full"></span> Listrik
                 </div>
             </div>
        </div>

        <!-- Property Performance -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Properti Terbaik</h3>
             <div class="space-y-4">
                <div v-for="item in reportData?.byProperty" :key="item.propertyId" class="space-y-1">
                     <div class="flex justify-between text-sm">
                        <span class="text-gray-700 dark:text-gray-300 font-medium">{{ item.propertyName }}</span>
                        <span class="text-gray-900 dark:text-white">{{ formatCurrency(item.totalIncome) }}</span>
                    </div>
                     <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 flex overflow-hidden">
                        <div class="bg-blue-500 h-2" :style="{ width: `${item.totalIncome > 0 ? (item.rentIncome / item.totalIncome) * 100 : 0}%` }"></div>
                        <div class="bg-orange-500 h-2" :style="{ width: `${item.totalIncome > 0 ? (item.utilityIncome / item.totalIncome) * 100 : 0}%` }"></div>
                    </div>
                </div>
                 <div v-if="!reportData?.byProperty.length" class="text-center text-gray-500 py-4">
                    Tidak ada data
                 </div>
             </div>
        </div>

    </div>

    <!-- Top Rooms Table -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
             <h3 class="font-semibold text-gray-900 dark:text-white">Kamar Berkinerja Terbaik</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th class="px-6 py-3">Kamar</th>
                        <th class="px-6 py-3">Properti</th>
                        <th class="px-6 py-3 text-right">Jumlah Pembayaran</th>
                        <th class="px-6 py-3 text-right">Total Pendapatan</th>
                    </tr>
                </thead>
                <tbody :key="`page-${page}`">
                    <tr v-if="!paginatedRooms.length">
                        <td colspan="4" class="px-6 py-8 text-center text-gray-500">Tidak ada data ditemukan</td>
                    </tr>
                    <tr v-for="room in paginatedRooms" :key="room.roomId" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3 font-medium text-gray-900 dark:text-white">
                            {{ room.roomName }}
                        </td>
                        <td class="px-6 py-3 text-gray-500">
                            {{ room.propertyName }}
                        </td>
                         <td class="px-6 py-3 text-right text-gray-500">
                            {{ room.paymentsCount }}
                        </td>
                        <td class="px-6 py-3 text-right font-bold text-emerald-600">
                            {{ formatCurrency(room.totalPaid) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div class="text-sm text-gray-500">
                Menampilkan {{ ((page - 1) * limit) + 1 }} - {{ Math.min(page * limit, totalRooms) }} dari {{ totalRooms }} data
            </div>
            <UPagination 
                :page="page" 
                :total="totalRooms" 
                :items-per-page="limit"
                @update:page="(p) => page = p"
            />
        </div>
    </div>

  </div>
</template>
