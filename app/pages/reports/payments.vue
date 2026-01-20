<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// -- State --
const now = new Date()
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

const formatDateForInput = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const startDate = ref(formatDateForInput(firstDayOfMonth))
const endDate = ref(formatDateForInput(lastDayOfMonth))
const selectedPropertyId = ref('all')
const selectedPaymentMethod = ref('all')
const selectedBillType = ref('all')

// -- Options --
const paymentMethods = [
  { label: 'All Methods', value: 'all' },
  { label: 'Cash', value: 'cash' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Credit Card', value: 'credit_card' },
  { label: 'Debit Card', value: 'debit_card' },
  { label: 'E-Wallet', value: 'e_wallet' }
]

const billTypes = [
  { label: 'All Types', value: 'all' },
  { label: 'Rent', value: 'rent' },
  { label: 'Utility', value: 'utility' }
]

// -- Fetch Properties --
const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])

const propertyOptions = computed(() => [
  { label: 'All Properties', value: 'all' },
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
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const getPaymentMethodLabel = (value: string) => {
    const found = paymentMethods.find(m => m.value === value)
    return found ? found.label : (value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' '))
}

</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Payment Report</h1>
        <p class="text-gray-500 dark:text-gray-400">Analyze incoming payments and trends</p>
      </div>
      
      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                 <UInput type="date" v-model="startDate" class="w-full" />
            </div>
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                 <UInput type="date" v-model="endDate" class="w-full" />
            </div>
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Property</label>
                 <USelect 
                    v-model="selectedPropertyId" 
                    :items="propertyOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                />
            </div>
            <div>
                 <label class="block text-xs font-medium text-gray-500 mb-1">Method</label>
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
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
           <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
             <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatCurrency(reportData?.summary.totalAmount || 0) }}</h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
             <UIcon name="i-heroicons-document-check" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Payments</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.totalPayments || 0 }}</h3>
           </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
             <UIcon name="i-heroicons-home" class="w-6 h-6 text-green-600 dark:text-green-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Rent Payments</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.rentPaymentsCount || 0 }}</h3>
           </div>
        </div>
      </div>

       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
             <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-orange-600 dark:text-orange-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Utility Payments</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.utilityPaymentsCount || 0 }}</h3>
           </div>
        </div>
      </div>
    </div>

    <!-- Charts / Stats Area -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- By Payment Method -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
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
                    No data available
                </div>
             </div>
        </div>

        <!-- By Property -->
        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
             <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Revenue by Property</h3>
             <div class="space-y-4">
                <div v-for="item in reportData?.byProperty" :key="item.propertyId" class="flex items-center justify-between border-b last:border-0 border-gray-100 dark:border-gray-800 py-3">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-gray-400" />
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.propertyName }}</div>
                            <div class="text-xs text-gray-500">{{ item.paymentsCount }} payments</div>
                        </div>
                    </div>
                    <div class="text-sm font-bold text-gray-900 dark:text-white">
                        {{ formatCurrency(item.totalAmount) }}
                    </div>
                </div>
                <div v-if="!reportData?.byProperty.length" class="text-center text-gray-500 py-4">
                    No data available
                </div>
             </div>
        </div>

    </div>

    <!-- Detailed Table -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
             <h3 class="font-semibold text-gray-900 dark:text-white">Recent Payments</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th class="px-6 py-3">Date</th>
                        <th class="px-6 py-3">Tenant / Room</th>
                        <th class="px-6 py-3">Type</th>
                        <th class="px-6 py-3">Method</th>
                        <th class="px-6 py-3 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="reportData?.payments.length === 0">
                        <td colspan="5" class="px-6 py-8 text-center text-gray-500">No payments found in this period</td>
                    </tr>
                    <tr v-for="payment in reportData?.payments" :key="payment.id" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3 whitespace-nowrap text-gray-500">
                            {{ payment.paidDate ? formatDate(payment.paidDate) : '-' }}
                        </td>
                        <td class="px-6 py-3">
                            <div class="font-medium text-gray-900 dark:text-white">{{ payment.tenantName }}</div>
                            <div class="text-xs text-gray-500">{{ payment.roomName }}</div>
                        </td>
                        <td class="px-6 py-3">
                            <UBadge :color="payment.billType === 'rent' ? 'success' : 'warning'" variant="subtle" size="xs">
                                {{ payment.billType }}
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
    </div>

  </div>
</template>
