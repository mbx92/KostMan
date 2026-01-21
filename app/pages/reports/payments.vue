<script setup lang="ts">
import DatePicker from '~/components/DatePicker.vue'

const route = useRoute()
const router = useRouter()

// -- State --
const now = new Date()
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

const formatDateToString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startDate = ref(formatDateToString(firstDayOfMonth))
const endDate = ref(formatDateToString(lastDayOfMonth))
const selectedPropertyId = ref('all')
const selectedPaymentMethod = ref('all')
const selectedBillType = ref('all')

// -- Options --
const paymentMethods = [
  { label: 'Semua Metode', value: 'all' },
  { label: 'Tunai', value: 'cash' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Kartu Kredit', value: 'credit_card' },
  { label: 'Kartu Debit', value: 'debit_card' },
  { label: 'E-Wallet', value: 'e_wallet' }
]

const billTypes = [
  { label: 'Semua Tipe', value: 'all' },
  { label: 'Sewa', value: 'rent' },
  { label: 'Listrik', value: 'utility' }
]

// -- Fetch Properties --
const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])

const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

// -- Interfaces --
interface Payment {
  id: string
  billType: 'rent' | 'utility'
  roomName: string
  tenantName: string
  amount: number
  paidDate: string | null
  paymentMethod: string
  period: string
}

interface PaymentReportData {
  summary: {
    totalPayments: number
    totalAmount: number
    rentPaymentsCount: number
    utilityPaymentsCount: number
    averagePaymentAmount: number
  }
  byPaymentMethod: Array<{
    method: string
    count: number
    amount: number
    percentage: number
  }>
  byProperty: Array<{
    propertyId: string
    propertyName: string
    paymentsCount: number
    totalAmount: number
  }>
  dailyPayments: Array<{
    date: string
    count: number
    amount: number
  }>
  payments: Payment[]
}

// -- Fetch Report --
const { data: reportData, pending } = await useFetch<PaymentReportData>('/api/reports/payments', {
  query: computed(() => ({
    startDate: startDate.value,
    endDate: endDate.value,
    propertyId: selectedPropertyId.value === 'all' ? undefined : selectedPropertyId.value,
    paymentMethod: selectedPaymentMethod.value === 'all' ? undefined : selectedPaymentMethod.value,
    billType: selectedBillType.value === 'all' ? undefined : selectedBillType.value
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

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const getPaymentMethodLabel = (value: string) => {
    const found = paymentMethods.find(m => m.value === value)
    return found ? found.label : (value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' '))
}

// -- Pagination --
const page = ref(1)
const limit = ref(10)

const paginatedPayments = computed(() => {
  if (!reportData.value?.payments) return []
  const start = (page.value - 1) * limit.value
  const end = start + limit.value
  return reportData.value.payments.slice(start, end)
})

const totalPayments = computed(() => reportData.value?.payments?.length || 0)
const totalPages = computed(() => Math.ceil(totalPayments.value / limit.value))



</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Laporan Pembayaran</h1>
        <p class="text-gray-500 dark:text-gray-400">Analisis pembayaran masuk dan tren</p>
      </div>
      
      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-auto">
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
                 <label class="block text-xs font-medium text-gray-500 mb-1">Metode</label>
                 <USelect 
                    v-model="selectedPaymentMethod" 
                    :items="paymentMethods"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                />
            </div>
          </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
           <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
             <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pendapatan</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap">{{ formatCurrency(reportData?.summary.totalAmount || 0) }}</h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
             <UIcon name="i-heroicons-document-check" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pembayaran</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.totalPayments || 0 }}</h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
             <UIcon name="i-heroicons-home" class="w-6 h-6 text-green-600 dark:text-green-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Pembayaran Sewa</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.rentPaymentsCount || 0 }}</h3>
           </div>
        </div>
      </div>

       <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
             <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-orange-600 dark:text-orange-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Pembayaran Listrik</p>
             <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.utilityPaymentsCount || 0 }}</h3>
           </div>
        </div>
      </div>
    </div>

    <!-- Charts / Stats Area -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- By Payment Method -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Metode Pembayaran</h3>
             <div class="space-y-4">
                <div v-for="item in reportData?.byPaymentMethod" :key="item.method" class="space-y-1">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-700 dark:text-gray-300">{{ getPaymentMethodLabel(item.method) }}</span>
                        <span class="text-gray-900 dark:text-white font-medium">{{ formatCurrency(item.amount) }} ({{ item.count }})</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div class="bg-indigo-600 h-2.5 rounded-full" :style="{ width: `${item.percentage}%` }"></div>
                    </div>
                </div>
                <div v-if="!reportData?.byPaymentMethod.length" class="text-center text-gray-500 py-4">
                    Tidak ada data
                </div>
             </div>
        </div>

        <!-- By Property -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Pendapatan per Properti</h3>
             <div class="space-y-4">
                <div v-for="item in reportData?.byProperty" :key="item.propertyId" class="flex items-center justify-between border-b last:border-0 border-gray-100 dark:border-gray-800 py-3">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-gray-400" />
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.propertyName }}</div>
                            <div class="text-xs text-gray-500">{{ item.paymentsCount }} pembayaran</div>
                        </div>
                    </div>
                    <div class="text-sm font-bold text-gray-900 dark:text-white">
                        {{ formatCurrency(item.totalAmount) }}
                    </div>
                </div>
                <div v-if="!reportData?.byProperty.length" class="text-center text-gray-500 py-4">
                    Tidak ada data
                </div>
             </div>
        </div>

    </div>

    <!-- Detailed Table -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
             <h3 class="font-semibold text-gray-900 dark:text-white">Pembayaran Terkini</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th class="px-6 py-3">Tanggal</th>
                        <th class="px-6 py-3">Penyewa / Kamar</th>
                        <th class="px-6 py-3">Tipe</th>
                        <th class="px-6 py-3">Metode</th>
                        <th class="px-6 py-3 text-right">Jumlah</th>
                    </tr>
                </thead>
                <tbody :key="`page-${page}`">
                    <tr v-if="paginatedPayments.length === 0">
                        <td colspan="5" class="px-6 py-8 text-center text-gray-500">Tidak ada pembayaran ditemukan untuk periode ini</td>
                    </tr>
                    <tr v-for="payment in paginatedPayments" :key="payment.id" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3 whitespace-nowrap text-gray-500">
                            {{ payment.paidDate ? formatDate(payment.paidDate) : '-' }}
                        </td>
                        <td class="px-6 py-3">
                            <div class="font-medium text-gray-900 dark:text-white">{{ payment.tenantName }}</div>
                            <div class="text-xs text-gray-500">{{ payment.roomName }}</div>
                        </td>
                        <td class="px-6 py-3">
                            <UBadge :color="payment.billType === 'rent' ? 'success' : 'warning'" variant="subtle" size="xs">
                                {{ payment.billType === 'rent' ? 'Sewa' : 'Listrik' }}
                            </UBadge>
                        </td>
                         <td class="px-6 py-3">
                             <div class="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                 <UIcon v-if="payment.paymentMethod === 'cash'" name="i-heroicons-banknotes" class="w-4 h-4" />
                                 <UIcon v-else-if="payment.paymentMethod.includes('card')" name="i-heroicons-credit-card" class="w-4 h-4" />
                                 <UIcon v-else name="i-heroicons-arrows-right-left" class="w-4 h-4" />
                                 {{ getPaymentMethodLabel(payment.paymentMethod) }}
                             </div>
                        </td>
                        <td class="px-6 py-3 text-right font-medium text-gray-900 dark:text-white">
                            {{ formatCurrency(payment.amount) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div class="text-sm text-gray-500">
                Menampilkan {{ ((page - 1) * limit) + 1 }} - {{ Math.min(page * limit, totalPayments) }} dari {{ totalPayments }} data
            </div>
            <div class="flex gap-1">
                <button 
                    v-for="p in totalPages" 
                    :key="p"
                    @click="page = p"
                    :class="[
                        'px-3 py-1 text-sm rounded',
                        page === p 
                            ? 'bg-primary-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    ]"
                >
                    {{ p }}
                </button>
            </div>
        </div>
    </div>

  </div>
</template>
