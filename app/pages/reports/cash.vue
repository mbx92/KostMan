<script setup lang="ts">
// Removed date-fns import

const route = useRoute()
const router = useRouter()

// -- State --
// Format: YYYY-MM
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const selectedMonth = ref(currentMonth)
const selectedPropertyId = ref('all')

// -- Fetch Properties for filter --
const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])

const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

// -- Types --
interface RentBill {
  roomId: string
  roomName: string
  rentPaid: number
  utilityPaid: number
  paidDate: string | null
}

interface UnpaidBill {
  roomId: string
  roomName: string
  tenantName: string
  rentAmount: number
  utilityAmount: number
  totalDue: number
  dueDate: string | null
}

interface ReportData {
  expectedCash: {
    totalRent: number
    totalUtilities: number
    total: number
    roomsCount: number
    occupiedRooms: Array<{
      roomId: string
      roomName: string
      rentAmount: number
      estimatedUtility: number
    }>
  }
  realCash: {
    totalRentPaid: number
    totalUtilitiesPaid: number
    total: number
    paidRoomsCount: number
    paidBills: RentBill[]
  }
  variance: {
    amount: number
    percentage: number
  }
  unpaidBills: UnpaidBill[]
}

// -- Fetch Report Data --
const { data: reportData, pending, refresh } = await useFetch<ReportData>('/api/reports/cash', {
  query: computed(() => ({
    month: selectedMonth.value,
    propertyId: selectedPropertyId.value === 'all' ? undefined : selectedPropertyId.value
  }))
})

// -- Helper Functions --
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// -- Computed for UI --
const expectedTotal = computed(() => reportData.value?.expectedCash.total || 0)
const realTotal = computed(() => reportData.value?.realCash.total || 0)
const varianceAmount = computed(() => reportData.value?.variance.amount || 0)
const variancePercentage = computed(() => reportData.value?.variance.percentage || 0)
const collectionRate = computed(() => {
  if (expectedTotal.value === 0) return 0
  return (realTotal.value / expectedTotal.value) * 100
})

const unpaidBills = computed(() => reportData.value?.unpaidBills || [])
const occupiedRooms = computed(() => reportData.value?.expectedCash.occupiedRooms || [])
const paidBills = computed(() => reportData.value?.realCash.paidBills || [])

// Watchers to refresh data
watch([selectedMonth, selectedPropertyId], () => {
    // refresh() is handled automatically by reactive query params in useFetch
})

</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Laporan Kas</h1>
        <p class="text-gray-500 dark:text-gray-400">Analisis Arus Kas Riil vs Ekspektasi</p>
      </div>
      
      <!-- Filters -->
      <div class="flex flex-col sm:flex-row gap-3">
        <UInput 
            type="month" 
            v-model="selectedMonth" 
            class="min-w-[200px]"
        />
        <USelect 
            v-model="selectedPropertyId" 
            :items="propertyOptions"
            value-key="value"
            label-key="label"
            class="min-w-[200px]"
        />
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      
      <!-- Expected -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Ekspektasi Kas</p>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatCurrency(expectedTotal) }}</h3>
            <p class="text-xs text-gray-400 mt-1">Dari {{ reportData?.expectedCash.roomsCount || 0 }} Kamar Terisi</p>
          </div>
        </div>
      </div>

      <!-- Real -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Kas Riil</p>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatCurrency(realTotal) }}</h3>
             <p class="text-xs text-gray-400 mt-1">Dari {{ reportData?.realCash.paidRoomsCount || 0 }} Kamar Lunas</p>
          </div>
        </div>
      </div>

      <!-- Variance -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg" :class="varianceAmount >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
            <UIcon :name="varianceAmount >= 0 ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'" 
                   class="w-6 h-6" 
                   :class="varianceAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Selisih</p>
             <h3 class="text-2xl font-bold mt-1" :class="varianceAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ formatCurrency(varianceAmount) }}
            </h3>
            <p class="text-xs mt-1" :class="varianceAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ varianceAmount >= 0 ? '+' : '' }}{{ variancePercentage }}%
            </p>
          </div>
        </div>
      </div>

       <!-- Collection Rate -->
       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <UIcon name="i-heroicons-chart-pie" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Tingkat Penagihan</p>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ collectionRate.toFixed(1) }}%</h3>
            <p class="text-xs text-gray-400 mt-1">Dari pendapatan yang diharapkan</p>
          </div>
        </div>
      </div>

    </div>

    <!-- Details Sections -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Expected Breakdown -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 class="font-semibold text-gray-900 dark:text-white">Ekspektasi Pendapatan per Kamar</h3>
                 <UBadge color="primary" variant="subtle">{{ occupiedRooms.length }} Terisi</UBadge>
            </div>
            <div class="overflow-x-auto max-h-[400px]">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                        <tr>
                            <th class="px-4 py-3">Kamar</th>
                            <th class="px-4 py-3 text-right">Sewa</th>
                            <th class="px-4 py-3 text-right">Est. Listrik</th>
                            <th class="px-4 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="occupiedRooms.length === 0">
                            <td colspan="4" class="px-4 py-8 text-center text-gray-500">Tidak ada kamar terisi ditemukan</td>
                        </tr>
                        <tr v-for="room in occupiedRooms" :key="room.roomId" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-4 py-3 font-medium">{{ room.roomName }}</td>
                            <td class="px-4 py-3 text-right">{{ formatCurrency(room.rentAmount) }}</td>
                            <td class="px-4 py-3 text-right">{{ formatCurrency(room.estimatedUtility) }}</td>
                            <td class="px-4 py-3 text-right font-semibold">{{ formatCurrency(room.rentAmount + room.estimatedUtility) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Real Payments -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
             <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 class="font-semibold text-gray-900 dark:text-white">Pembayaran Riil per Kamar</h3>
                <UBadge color="success" variant="subtle">{{ paidBills.length }} Lunas</UBadge>
            </div>
             <div class="overflow-x-auto max-h-[400px]">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                        <tr>
                            <th class="px-4 py-3">Kamar</th>
                            <th class="px-4 py-3 text-right">Sewa Dibayar</th>
                            <th class="px-4 py-3 text-right">Listrik Dibayar</th>
                            <th class="px-4 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="paidBills.length === 0">
                             <td colspan="4" class="px-4 py-8 text-center text-gray-500">Tidak ada pembayaran terverifikasi bulan ini</td>
                        </tr>
                        <tr v-for="bill in paidBills" :key="bill.roomId" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-4 py-3 font-medium">
                                <div>{{ bill.roomName }}</div>
                                <div class="text-xs text-gray-400">{{ formatDate(bill.paidDate) }}</div>
                            </td>
                            <td class="px-4 py-3 text-right">{{ formatCurrency(bill.rentPaid) }}</td>
                             <td class="px-4 py-3 text-right">{{ formatCurrency(bill.utilityPaid) }}</td>
                            <td class="px-4 py-3 text-right font-semibold">{{ formatCurrency(bill.rentPaid + bill.utilityPaid) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

    </div>

    <!-- Unpaid Bills Section -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
             <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white">Tagihan Belum Lunas</h3>
                <UBadge color="error" variant="subtle">{{ unpaidBills.length }} Tertunda</UBadge>
             </div>
        </div>
        <div class="overflow-x-auto">
             <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                         <th class="px-6 py-3">Kamar</th>
                         <th class="px-6 py-3">Jatuh Tempo</th>
                         <th class="px-6 py-3 text-right">Sewa</th>
                         <th class="px-6 py-3 text-right">Listrik</th>
                         <th class="px-6 py-3 text-right">Total Tagihan</th>
                         <th class="px-6 py-3 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="unpaidBills.length === 0">
                        <td colspan="6" class="px-6 py-8 text-center text-gray-500">Tidak ada tagihan belum lunas untuk periode ini</td>
                    </tr>
                    <tr v-for="(bill, index) in unpaidBills" :key="index" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3 font-medium">{{ bill.roomName }}</td>
                        <td class="px-6 py-3 text-gray-500">{{ bill.dueDate ? formatDate(bill.dueDate) : '-' }}</td>
                        <td class="px-6 py-3 text-right">{{ formatCurrency(bill.rentAmount) }}</td>
                        <td class="px-6 py-3 text-right">{{ formatCurrency(bill.utilityAmount) }}</td>
                        <td class="px-6 py-3 text-right font-bold text-red-600">{{ formatCurrency(bill.totalDue) }}</td>
                         <td class="px-6 py-3 text-right">
                            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-bell" />
                        </td>
                    </tr>
                </tbody>
             </table>
        </div>
    </div>

  </div>
</template>
