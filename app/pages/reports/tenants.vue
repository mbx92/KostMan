<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// -- State --
const selectedPropertyId = ref('all')
const selectedStatus = ref('all')

// -- Options --
const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
]

// -- Fetch Properties --
const { data: propertiesData } = await useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])
const propertyOptions = computed(() => [
  { label: 'All Properties', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

// -- Interfaces --
interface TenantReportData {
  summary: {
    totalTenants: number
    activeTenants: number
    inactiveTenants: number
    averageTenancyDuration: number
    occupancyRate: number
  }
  tenants: Array<{
    id: string
    name: string
    contact: string
    status: string
    roomName: string
    propertyName: string
    moveInDate: string | null
    monthlyRent: number
    paymentHistory: {
      totalPaid: number
      totalBills: number
      paidBills: number
      unpaidBills: number
      outstandingBalance: number
      onTimePayments: number
      latePayments: number
    }
    tenancyDuration: number
  }>
  byProperty: Array<{
    propertyId: string
    propertyName: string
    tenantsCount: number
    occupancyRate: number
  }>
}

// -- Fetch Report --
const { data: reportData, pending } = await useFetch<TenantReportData>('/api/reports/tenants', {
  query: computed(() => ({
    propertyId: selectedPropertyId.value === 'all' ? undefined : selectedPropertyId.value,
    status: selectedStatus.value === 'all' ? undefined : selectedStatus.value
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
  return new Date(dateString).toLocaleDateString('en-GB')
}

// Compute total outstanding from loaded tenants
const totalOutstanding = computed(() => {
    return reportData.value?.tenants.reduce((sum, t) => sum + t.paymentHistory.outstandingBalance, 0) || 0
})

</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenant Report</h1>
        <p class="text-gray-500 dark:text-gray-400">Occupancy and payment behavior analysis</p>
      </div>
      
      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-auto flex gap-3">
            <div class="min-w-[200px]">
                 <label class="block text-xs font-medium text-gray-500 mb-1">Property</label>
                 <USelect 
                    v-model="selectedPropertyId" 
                    :items="propertyOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                />
            </div>
            <div class="min-w-[150px]">
                 <label class="block text-xs font-medium text-gray-500 mb-1">Status</label>
                 <USelect 
                    v-model="selectedStatus" 
                    :items="statusOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                />
            </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
           <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
             <UIcon name="i-heroicons-users" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tenants</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ reportData?.summary.totalTenants || 0 }}</h3>
             <p class="text-xs text-green-500 mt-1">{{ reportData?.summary.activeTenants || 0 }} Active</p>
           </div>
        </div>
      </div>

       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
             <UIcon name="i-heroicons-building-office" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Occupancy Rate</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ (reportData?.summary.occupancyRate || 0).toFixed(1) }}%</h3>
             <p class="text-xs text-gray-400 mt-1">Based on rooms</p>
           </div>
        </div>
      </div>

       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
             <UIcon name="i-heroicons-clock" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Duration</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ (reportData?.summary.averageTenancyDuration || 0).toFixed(1) }}</h3>
             <p class="text-xs text-gray-400 mt-1">Months</p>
           </div>
        </div>
      </div>
      
       <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
         <div class="flex items-center gap-4">
           <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
             <UIcon name="i-heroicons-exclamation-circle" class="w-6 h-6 text-red-600 dark:text-red-400" />
           </div>
           <div>
             <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Outstanding</p>
             <h3 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatCurrency(totalOutstanding) }}</h3>
             <p class="text-xs text-gray-400 mt-1">Unpaid bills</p>
           </div>
        </div>
      </div>
    </div>
    
    <!-- Tenants List -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
             <h3 class="font-semibold text-gray-900 dark:text-white">Tenant Details</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th class="px-6 py-3">Tenant</th>
                        <th class="px-6 py-3">Property / Room</th>
                        <th class="px-6 py-3">Status</th>
                        <th class="px-6 py-3 text-right">Bills</th>
                        <th class="px-6 py-3 text-right">Total Paid</th>
                         <th class="px-6 py-3 text-right">Outstanding</th>
                        <th class="px-6 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="reportData?.tenants.length === 0">
                        <td colspan="7" class="px-6 py-8 text-center text-gray-500">No tenants found</td>
                    </tr>
                    <tr v-for="tenant in reportData?.tenants" :key="tenant.id" class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="px-6 py-3">
                            <div class="font-medium text-gray-900 dark:text-white">{{ tenant.name }}</div>
                            <div class="text-xs text-gray-500">{{ tenant.contact }}</div>
                        </td>
                        <td class="px-6 py-3">
                            <div class="text-gray-900 dark:text-white">{{ tenant.propertyName }}</div>
                            <div class="text-xs text-gray-500">{{ tenant.roomName }}</div>
                             <div class="text-xs text-gray-400 text-[10px]">Since {{ formatDate(tenant.moveInDate) }}</div>
                        </td>
                        <td class="px-6 py-3">
                            <UBadge :color="tenant.status === 'active' ? 'success' : 'neutral'" variant="subtle" size="xs">
                                {{ tenant.status }}
                            </UBadge>
                        </td>
                         <td class="px-6 py-3 text-right text-gray-500">
                             <div>{{ tenant.paymentHistory.totalBills }} Total</div>
                             <div class="text-xs" :class="tenant.paymentHistory.latePayments > 0 ? 'text-red-500' : 'text-green-500'">
                                 {{ tenant.paymentHistory.latePayments }} Late
                             </div>
                        </td>
                        <td class="px-6 py-3 text-right text-gray-900 dark:text-white font-medium">
                            {{ formatCurrency(tenant.paymentHistory.totalPaid) }}
                        </td>
                         <td class="px-6 py-3 text-right font-bold" :class="tenant.paymentHistory.outstandingBalance > 0 ? 'text-red-600' : 'text-gray-400'">
                            {{ formatCurrency(tenant.paymentHistory.outstandingBalance) }}
                        </td>
                        <td class="px-6 py-3 text-right">
                            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" :to="`/tenants/${tenant.id}`" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
  </div>
</template>
