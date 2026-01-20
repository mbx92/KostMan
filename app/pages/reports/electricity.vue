<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// -- State --
const now = new Date()
// Helper to deal with local timezone offset for input value
const formatDateForInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

const startDate = ref(formatDateForInput(getStartOfMonth(now)))
const endDate = ref(formatDateForInput(getEndOfMonth(now)))
const selectedPropertyId = ref('all')

// -- Fetch Properties --
const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])
const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

// -- Interfaces --
interface ElectricityReportData {
  summary: {
    totalUsage: number
    totalCost: number
    averageUsagePerRoom: number
    averageCostPerRoom: number
    highestUsageRoom: { roomName: string, usage: number } | null
    lowestUsageRoom: { roomName: string, usage: number } | null
  }
  byPeriod: Array<{
    period: string
    totalUsage: number
    totalCost: number
    roomsReported: number
  }>
  byRoom: Array<{
    roomId: string
    roomName: string
    propertyName: string
    totalUsage: number
    totalCost: number
    averageUsage: number
    trend: 'increasing' | 'decreasing' | 'stable'
    readings: any[]
  }>
  unusualUsage: Array<{
    roomId: string
    roomName: string
    period: string
    usage: number
    averageUsage: number
    deviation: number
  }>
}

// -- Fetch Report --
const { data: reportData, pending } = await useFetch<ElectricityReportData>('/api/reports/electricity', {
  query: computed(() => ({
    startDate: startDate.value,
    endDate: endDate.value,
    propertyId: selectedPropertyId.value === 'all' ? undefined : selectedPropertyId.value
  }))
})

// -- Helpers --
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatNumber = (val: number) => new Intl.NumberFormat('id-ID').format(val)

const maxUsage = computed(() => {
    if (!reportData.value?.byPeriod.length) return 100
    return Math.max(...reportData.value.byPeriod.map(p => p.totalUsage))
})

// Transform English trend to Indonesian
const translateTrend = (trend: string): string => {
    switch (trend) {
        case 'increasing':
            return 'meningkat';
        case 'decreasing':
            return 'menurun';
        case 'stable':
            return 'stabil';
        default:
            return trend;
    }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Penggunaan Listrik</h1>
        <p class="text-gray-500 dark:text-gray-400">Pantau konsumsi daya dan biaya</p>
      </div>
      
      <!-- Filters -->
      <div class="flex gap-3 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
           <div>
               <UInput type="date" v-model="startDate" />
           </div>
           <div>
               <UInput type="date" v-model="endDate" />
           </div>
           <div>
                <USelect 
                    v-model="selectedPropertyId" 
                    :items="propertyOptions"
                    value-key="value"
                    label-key="label"
                    class="min-w-[150px]"
                />
           </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
           <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
             <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Penggunaan</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatNumber(reportData?.summary.totalUsage || 0) }} <span class="text-sm font-normal text-gray-500">kWh</span></h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
             <UIcon name="i-heroicons-currency-dollar" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Biaya</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatCurrency(reportData?.summary.totalCost || 0) }}</h3>
           </div>
        </div>
      </div>

       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
             <UIcon name="i-heroicons-chart-bar" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Rata-rata / Kamar</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatNumber(Math.round(reportData?.summary.averageUsagePerRoom || 0)) }} <span class="text-sm font-normal text-gray-500">kWh</span></h3>
           </div>
        </div>
      </div>
      
       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
             <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-red-600 dark:text-red-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Peringatan</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.unusualUsage.length || 0 }}</h3>
             <p class="text-xs text-gray-400 mt-1">Penyimpangan tidak wajar</p>
           </div>
        </div>
      </div>
    </div>

    <!-- Usage Trend Chart -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
         <h3 class="font-semibold text-gray-900 dark:text-white mb-6">Tren Penggunaan (kWh)</h3>
         <div class="h-64 flex items-end justify-between gap-2 overflow-x-auto pb-2">
             <div v-for="item in reportData?.byPeriod" :key="item.period" class="flex flex-col items-center gap-2 group min-w-[40px] flex-1">
                 <div class="w-full bg-yellow-100 dark:bg-yellow-900/30 rounded-t-lg relative flex items-end justify-center group-hover:bg-yellow-200 transition-colors" 
                      :style="{ height: `${(item.totalUsage / (maxUsage || 1)) * 100}%` }">
                     <div class="opacity-0 group-hover:opacity-100 absolute -top-12 bg-black text-white text-xs p-1.5 rounded pointer-events-none whitespace-nowrap z-10">
                         {{ formatNumber(item.totalUsage) }} kWh
                     </div>
                 </div>
                 <span class="text-xs text-gray-500 rotate-0 truncate max-w-full">{{ item.period }}</span>
             </div>
             <div v-if="!reportData?.byPeriod.length" class="w-full h-full flex items-center justify-center text-gray-400">
                 Tidak ada data penggunaan untuk periode ini
             </div>
         </div>
    </div>
    
    <!-- Detail Table -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
             <h3 class="font-semibold text-gray-900 dark:text-white">Detail Penggunaan Kamar</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th class="px-6 py-3">Kamar</th>
                        <th class="px-6 py-3">Properti</th>
                        <th class="px-6 py-3 text-right">Total Penggunaan</th>
                        <th class="px-6 py-3 text-right">Rata-rata Penggunaan</th>
                         <th class="px-6 py-3 text-center">Tren</th>
                        <th class="px-6 py-3 text-right">Total Biaya</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="reportData?.byRoom.length === 0">
                        <td colspan="6" class="px-6 py-8 text-center text-gray-500">Tidak ada data ditemukan</td>
                    </tr>
                    <tr v-for="room in reportData?.byRoom" :key="room.roomId" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3 font-medium text-gray-900 dark:text-white">{{ room.roomName }}</td>
                        <td class="px-6 py-3 text-gray-500">{{ room.propertyName }}</td>
                         <td class="px-6 py-3 text-right font-medium">{{ formatNumber(room.totalUsage) }} kWh</td>
                        <td class="px-6 py-3 text-right text-gray-500">{{ formatNumber(Math.round(room.averageUsage)) }} kWh</td>
                        <td class="px-6 py-3 text-center">
                            <UBadge 
                                :color="room.trend === 'increasing' ? 'warning' : (room.trend === 'decreasing' ? 'success' : 'neutral')" 
                                variant="subtle" size="xs">
                                {{ translateTrend(room.trend) }}
                            </UBadge>
                        </td>
                        <td class="px-6 py-3 text-right font-medium text-gray-900 dark:text-white">{{ formatCurrency(room.totalCost) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Anomalies Section -->
    <div v-if="reportData?.unusualUsage.length" class="bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 p-6">
        <h3 class="font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
            Peringatan Penggunaan Tinggi
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="(alert, idx) in reportData.unusualUsage" :key="idx" class="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border border-red-100 dark:border-red-900/30">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white">{{ alert.roomName }}</div>
                        <div class="text-xs text-gray-500">{{ alert.period }}</div>
                    </div>
                    <UBadge color="error" variant="subtle">{{ Math.round(alert.deviation) }}% penyimpangan</UBadge>
                </div>
                <div class="mt-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-500">Penggunaan:</span>
                        <span class="font-medium">{{ formatNumber(alert.usage) }} kWh</span>
                    </div>
                     <div class="flex justify-between">
                        <span class="text-gray-500">Rata-rata:</span>
                        <span class="font-medium">{{ formatNumber(Math.round(alert.averageUsage)) }} kWh</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
  </div>
</template>
