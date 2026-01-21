<script setup lang="ts">
import DatePicker from '~/components/DatePicker.vue'

const route = useRoute()
const router = useRouter()

// -- State --
const now = new Date()
const formatDateForInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const getStartOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1) // Jan 1st
const getEndOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31) // Dec 31st

const formatDateToString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startDate = ref(formatDateToString(getStartOfYear(now))) // Default to This Year for P&L usually
const endDate = ref(formatDateToString(getEndOfYear(now)))

const selectedPropertyId = ref('all')
const groupBy = ref('month')

// -- Options --
const groupByOptions = [
    { label: 'Bulanan', value: 'month' },
    { label: 'Tahunan', value: 'year' }
]

const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])
const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

const presetRanges = [
  { label: 'Bulan Ini', getValue: () => [getStartOfMonth(new Date()), getEndOfMonth(new Date())] },
  { label: 'Tahun Ini', getValue: () => [getStartOfYear(new Date()), getEndOfYear(new Date())] }
]

const applyPreset = (range: { getValue: () => Date[] }) => {
    const [start, end] = range.getValue()
    startDate.value = formatDateToString(start)
    endDate.value = formatDateToString(end)
}

const isPresetSelected = (range: { getValue: () => Date[] }) => {
    const [start, end] = range.getValue()
    return startDate.value === formatDateToString(start) && 
           endDate.value === formatDateToString(end)
}

// -- Interfaces --
interface PLReportData {
  summary: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    profitMargin: number
    revenueBreakdown: {
      rentIncome: number
      utilityIncome: number
      otherIncome: number
    }
    expenseBreakdown: Array<{
      category: string
      amount: number
      percentage: number
    }>
  }
  byPeriod: Array<{
    period: string
    revenue: number
    expenses: number
    profit: number
    profitMargin: number
  }>
  byProperty: Array<{
    propertyId: string
    propertyName: string
    revenue: number
    expenses: number
    profit: number
    profitMargin: number
  }>
}

// -- Fetch Report --
const { data: reportData, pending } = await useFetch<PLReportData>('/api/reports/profit-loss', {
  query: computed(() => ({
    startDate: startDate.value,
    endDate: endDate.value,
    propertyId: selectedPropertyId.value === 'all' ? undefined : selectedPropertyId.value,
    groupBy: groupBy.value
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
const formatPercent = (val: number) => `${val.toFixed(1)}%`

const maxVal = computed(() => {
    if (!reportData.value?.byPeriod.length) return 100
    const vals = reportData.value.byPeriod.map(p => Math.max(p.revenue, p.expenses))
    return Math.max(...vals)
})

</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Laba Rugi</h1>
        <p class="text-gray-500 dark:text-gray-400">Ringkasan kinerja keuangan</p>
      </div>
      
      <!-- Quick Filters -->
      <div class="flex gap-2">
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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Revenue -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
             <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                 <UIcon name="i-heroicons-arrow-trending-up" class="w-6 h-6 text-green-600 dark:text-green-400" />
             </div>
             <div>
                 <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pendapatan</p>
                 <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap">{{ formatCurrency(reportData?.summary.totalRevenue || 0) }}</h3>
                 <p class="text-xs text-gray-400 mt-1">
                     Sewa: {{ formatCurrency(reportData?.summary.revenueBreakdown.rentIncome || 0) }}
                 </p>
             </div>
         </div>
      </div>

       <!-- Expenses -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
             <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                 <UIcon name="i-heroicons-arrow-trending-down" class="w-6 h-6 text-red-600 dark:text-red-400" />
             </div>
             <div>
                 <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pengeluaran</p>
                 <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap">{{ formatCurrency(reportData?.summary.totalExpenses || 0) }}</h3>
                 <p class="text-xs text-gray-400 mt-1 truncate max-w-[150px]" :title="reportData?.summary.expenseBreakdown[0]?.category">
                    Top: {{ reportData?.summary.expenseBreakdown[0]?.category || '-' }}
                 </p>
             </div>
         </div>
      </div>

       <!-- Net Profit -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
             <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                 <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
             </div>
             <div>
                 <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Laba Bersih</p>
                 <h3 class="text-xl font-bold mt-1 whitespace-nowrap" :class="(reportData?.summary.netProfit || 0) >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'">
                     {{ formatCurrency(reportData?.summary.netProfit || 0) }}
                 </h3>
                 <p class="text-xs font-medium mt-1" :class="(reportData?.summary.profitMargin || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                     {{ formatPercent(reportData?.summary.profitMargin || 0) }} Margin
                 </p>
             </div>
         </div>
      </div>
    </div>

    <!-- Charts / Analysis -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- P&L Trend -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-6">Tren Keuangan</h3>
             <div class="h-64 flex items-end justify-between gap-4 overflow-x-auto pb-4">
                 <div v-for="item in reportData?.byPeriod" :key="item.period" class="h-full flex flex-col items-center gap-2 group min-w-[50px] flex-1">
                     
                     <div class="w-full h-full relative flex items-end justify-center gap-1">
                         <!-- Revenue Bar -->
                         <div class="w-3 bg-green-500/80 hover:bg-green-500 rounded-t-sm transition-all" 
                              :style="{ height: item.revenue > 0 ? `${Math.max(10, (item.revenue / (maxVal || 1)) * 100)}%` : '8px' }"
                              :title="'Rev: ' + formatCurrency(item.revenue)"></div>
                         <!-- Expense Bar -->
                         <div class="w-3 bg-red-500/80 hover:bg-red-500 rounded-t-sm transition-all" 
                              :style="{ height: item.expenses > 0 ? `${Math.max(10, (item.expenses / (maxVal || 1)) * 100)}%` : '8px' }"
                              :title="'Exp: ' + formatCurrency(item.expenses)"></div>
                     </div>
                     <span class="text-xs text-gray-500">{{ item.period }}</span>
                 </div>
                 <div v-if="!reportData?.byPeriod.length" class="w-full h-full flex items-center justify-center text-gray-400">
                     Tidak ada data tren
                 </div>
             </div>
             <div class="flex justify-center gap-4 mt-2">
                 <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 bg-green-500 rounded-sm"></span> Pendapatan</div>
                 <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 bg-red-500 rounded-sm"></span> Pengeluaran</div>
             </div>
        </div>

        <!-- Expense Composition -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Rincian Pengeluaran</h3>
             <div class="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                <div v-for="item in reportData?.summary.expenseBreakdown" :key="item.category" class="space-y-1">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 dark:text-gray-300">{{ item.category }}</span>
                        <span class="text-gray-900 dark:text-white font-medium">{{ formatCurrency(item.amount) }}</span>
                    </div>
                    <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-red-500 h-1.5" :style="{ width: `${item.percentage}%` }"></div>
                    </div>
                </div>
                <div v-if="!reportData?.summary.expenseBreakdown.length" class="text-center text-gray-500 py-4">
                    Tidak ada pengeluaran
                </div>
             </div>
        </div>
    </div>
    
    <!-- Property Performance Table -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
             <h3 class="font-semibold text-gray-900 dark:text-white">Kinerja per Properti</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th class="px-6 py-3">Properti</th>
                        <th class="px-6 py-3 text-right">Pendapatan</th>
                        <th class="px-6 py-3 text-right">Pengeluaran</th>
                        <th class="px-6 py-3 text-right">Laba Bersih</th>
                        <th class="px-6 py-3 text-right">Margin</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="reportData?.byProperty.length === 0">
                        <td colspan="5" class="px-6 py-8 text-center text-gray-500">Tidak ada data ditemukan</td>
                    </tr>
                    <tr v-for="prop in reportData?.byProperty" :key="prop.propertyId" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3 font-medium text-gray-900 dark:text-white">{{ prop.propertyName }}</td>
                        <td class="px-6 py-3 text-right text-green-600 font-medium">{{ formatCurrency(prop.revenue) }}</td>
                        <td class="px-6 py-3 text-right text-red-600 font-medium">{{ formatCurrency(prop.expenses) }}</td>
                        <td class="px-6 py-3 text-right font-bold" :class="prop.profit >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'">
                            {{ formatCurrency(prop.profit) }}
                        </td>
                         <td class="px-6 py-3 text-right text-gray-500">
                             {{ formatPercent(prop.profitMargin) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
  </div>
</template>
