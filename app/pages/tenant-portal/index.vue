<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['tenant-auth']
})

const token = useCookie('tenant-token')
const router = useRouter()
const toast = useToast()
const colorMode = useColorMode()

const tenant = ref<any>(null)
const rentBills = ref<any[]>([])
const utilityBills = ref<any[]>([])
const loading = ref(true)

// Fetch tenant data and bills
const fetchData = async () => {
  loading.value = true
  try {
    const [meResponse, billsResponse] = await Promise.all([
      $fetch('/api/tenant-auth/me', {
        headers: { Authorization: `Bearer ${token.value}` }
      }),
      $fetch('/api/tenant-auth/bills', {
        headers: { Authorization: `Bearer ${token.value}` }
      })
    ])

    tenant.value = meResponse.tenant
    rentBills.value = billsResponse.rentBills
    utilityBills.value = billsResponse.utilityBills
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: 'Gagal memuat data',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// Logout
const logout = () => {
  token.value = null
  router.push('/tenant-portal/login')
  toast.add({
    title: 'Logout Berhasil',
    description: 'Anda telah keluar dari portal',
    color: 'success'
  })
}

// Format currency
const formatCurrency = (val: number | string) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(val))
}

// Format date range
const formatDateRange = (start: string, end: string) => {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${s.toLocaleDateString('id-ID', opts)} - ${e.toLocaleDateString('id-ID', opts)}`
}

// Calculate stats
const totalUnpaidRent = computed(() => 
  rentBills.value.filter(b => !b.isPaid).reduce((sum, b) => sum + Number(b.totalAmount), 0)
)

const totalUnpaidUtility = computed(() => 
  utilityBills.value.filter(b => !b.isPaid).reduce((sum, b) => sum + Number(b.totalAmount), 0)
)

const totalUnpaid = computed(() => totalUnpaidRent.value + totalUnpaidUtility.value)

// View mode toggle
const viewMode = ref<'list' | 'grid'>('grid') // Default grid for mobile-friendly

// Download receipt
const downloadingBillId = ref<string | null>(null)

const downloadRentReceipt = async (billId: string) => {
  downloadingBillId.value = billId
  try {
    // Use tenant-specific endpoint
    const response = await $fetch<{ token: string; publicUrl: string }>(
      `/api/tenant-receipt`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
        body: { 
          billId,
          billType: 'rent' 
        },
      }
    )
    
    // Open in new tab for download/view
    window.open(response.publicUrl, '_blank')
    
    toast.add({
      title: 'Berhasil',
      description: 'Kwitansi dibuka di tab baru',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: 'Gagal membuat link kwitansi',
      color: 'error',
    })
  } finally {
    downloadingBillId.value = null
  }
}

const downloadUtilityReceipt = async (billId: string) => {
  downloadingBillId.value = billId
  try {
    const response = await $fetch<{ token: string; publicUrl: string }>(
      `/api/tenant-receipt`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
        body: { 
          billId,
          billType: 'utility' 
        },
      }
    )
    
    window.open(response.publicUrl, '_blank')
    
    toast.add({
      title: 'Berhasil',
      description: 'Kwitansi dibuka di tab baru',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Error',
      description: 'Gagal membuat link kwitansi',
      color: 'error',
    })
  } finally {
    downloadingBillId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-home-modern" class="w-8 h-8 text-primary-500" />
            <div>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">Portal Penghuni</h1>
              <p class="text-sm text-gray-600 dark:text-gray-400" v-if="tenant">{{ tenant.name }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
              color="neutral"
              variant="ghost"
              @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-arrow-right-on-rectangle"
              @click="logout"
            >
              Keluar
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="loading" class="text-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin mx-auto" />
        <p class="text-gray-500 mt-4">Memuat data...</p>
      </div>

      <div v-else class="space-y-6">
        <!-- View Mode Toggle -->
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Daftar Tagihan</h2>
          <div class="flex gap-1">
            <UButton
              :color="viewMode === 'grid' ? 'primary' : 'neutral'"
              variant="soft"
              icon="i-heroicons-squares-2x2"
              size="sm"
              @click="viewMode = 'grid'"
            >
              <span class="hidden sm:inline">Grid</span>
            </UButton>
            <UButton
              :color="viewMode === 'list' ? 'primary' : 'neutral'"
              variant="soft"
              icon="i-heroicons-list-bullet"
              size="sm"
              @click="viewMode = 'list'"
            >
              <span class="hidden sm:inline">List</span>
            </UButton>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UCard>
            <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Total Belum Dibayar</div>
            <div class="text-2xl font-bold text-red-500 mt-1">{{ formatCurrency(totalUnpaid) }}</div>
          </UCard>
          <UCard>
            <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Sewa Belum Dibayar</div>
            <div class="text-xl font-bold text-orange-500 mt-1">{{ formatCurrency(totalUnpaidRent) }}</div>
          </UCard>
          <UCard>
            <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Utilitas Belum Dibayar</div>
            <div class="text-xl font-bold text-yellow-500 mt-1">{{ formatCurrency(totalUnpaidUtility) }}</div>
          </UCard>
        </div>

        <!-- Rent Bills -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-home" class="w-5 h-5" />
              Tagihan Sewa
            </h2>
          </template>

          <div v-if="rentBills.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-inbox" class="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p class="text-gray-500">Belum ada tagihan sewa</p>
          </div>

          <!-- Grid View -->
          <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="bill in rentBills" 
              :key="bill.id"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <div class="text-xs text-gray-500 mb-1">{{ bill.property?.name }}</div>
                  <div class="font-semibold text-gray-900 dark:text-white">{{ bill.room?.name }}</div>
                </div>
                <UBadge :color="bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                  {{ bill.isPaid ? 'Lunas' : 'Belum Bayar' }}
                </UBadge>
              </div>
              
              <div class="space-y-2 mb-4">
                <div class="flex items-center gap-2 text-sm">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-gray-400" />
                  <span class="text-gray-600 dark:text-gray-400">{{ formatDateRange(bill.periodStartDate, bill.periodEndDate) }}</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4 text-gray-400" />
                  <span class="text-gray-600 dark:text-gray-400">{{ bill.monthsCovered || 1 }} bulan</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-gray-400" />
                  <span class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(bill.totalAmount) }}</span>
                </div>
              </div>
              
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-document-arrow-down"
                :loading="downloadingBillId === bill.id"
                @click="downloadRentReceipt(bill.id)"
                block
              >
                Download Kwitansi
              </UButton>
            </div>
          </div>

          <!-- List View -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th class="p-3 text-left font-medium text-gray-500">Periode</th>
                  <th class="p-3 text-left font-medium text-gray-500">Kamar</th>
                  <th class="p-3 text-right font-medium text-gray-500">Jumlah</th>
                  <th class="p-3 text-center font-medium text-gray-500">Status</th>
                  <th class="p-3 text-center font-medium text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="bill in rentBills" :key="bill.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td class="p-3">
                    <div class="font-medium">{{ formatDateRange(bill.periodStartDate, bill.periodEndDate) }}</div>
                    <div class="text-xs text-gray-500">{{ bill.monthsCovered || 1 }} bulan</div>
                  </td>
                  <td class="p-3">
                    <div class="font-medium">{{ bill.room?.name }}</div>
                    <div class="text-xs text-gray-500">{{ bill.property?.name }}</div>
                  </td>
                  <td class="p-3 text-right font-bold">{{ formatCurrency(bill.totalAmount) }}</td>
                  <td class="p-3 text-center">
                    <UBadge :color="bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                      {{ bill.isPaid ? 'Lunas' : 'Belum Bayar' }}
                    </UBadge>
                  </td>
                  <td class="p-3 text-center">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-document-arrow-down"
                      :loading="downloadingBillId === bill.id"
                      @click="downloadRentReceipt(bill.id)"
                    >
                      Download
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- Utility Bills -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-bolt" class="w-5 h-5" />
              Tagihan Utilitas
            </h2>
          </template>

          <div v-if="utilityBills.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-inbox" class="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p class="text-gray-500">Belum ada tagihan utilitas</p>
          </div>

          <!-- Grid View -->
          <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="bill in utilityBills" 
              :key="bill.id"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <div class="text-xs text-gray-500 mb-1">{{ bill.property?.name }}</div>
                  <div class="font-semibold text-gray-900 dark:text-white">{{ bill.room?.name }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ bill.period }}</div>
                </div>
                <UBadge :color="bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                  {{ bill.isPaid ? 'Lunas' : 'Belum Bayar' }}
                </UBadge>
              </div>
              
              <div class="space-y-2 mb-4">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-bolt" class="w-4 h-4 text-yellow-500" />
                    <span class="text-gray-600 dark:text-gray-400">Listrik</span>
                  </div>
                  <div class="text-right">
                    <div class="font-medium">{{ bill.meterEnd - bill.meterStart }} kWh</div>
                    <div class="text-xs text-gray-500">{{ formatCurrency(bill.usageCost) }}</div>
                  </div>
                </div>
                
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-beaker" class="w-4 h-4 text-blue-500" />
                    <span class="text-gray-600 dark:text-gray-400">Air</span>
                  </div>
                  <div class="font-medium">{{ formatCurrency(bill.waterFee) }}</div>
                </div>
                
                <div v-if="Number(bill.trashFee) > 0" class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-trash" class="w-4 h-4 text-green-500" />
                    <span class="text-gray-600 dark:text-gray-400">Sampah</span>
                  </div>
                  <div class="font-medium">{{ formatCurrency(bill.trashFee) }}</div>
                </div>
                
                <div class="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                    <span class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(bill.totalAmount) }}</span>
                  </div>
                </div>
              </div>
              
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-document-arrow-down"
                :loading="downloadingBillId === bill.id"
                @click="downloadUtilityReceipt(bill.id)"
                block
              >
                Download Kwitansi
              </UButton>
            </div>
          </div>

          <!-- List View -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th class="p-3 text-left font-medium text-gray-500">Periode</th>
                  <th class="p-3 text-left font-medium text-gray-500">Kamar</th>
                  <th class="p-3 text-left font-medium text-gray-500">Detail</th>
                  <th class="p-3 text-right font-medium text-gray-500">Jumlah</th>
                  <th class="p-3 text-center font-medium text-gray-500">Status</th>
                  <th class="p-3 text-center font-medium text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="bill in utilityBills" :key="bill.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td class="p-3 font-medium">{{ bill.period }}</td>
                  <td class="p-3">
                    <div class="font-medium">{{ bill.room?.name }}</div>
                    <div class="text-xs text-gray-500">{{ bill.property?.name }}</div>
                  </td>
                  <td class="p-3">
                    <div class="space-y-1 text-sm">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-bolt" class="w-4 h-4 text-yellow-500" />
                        <span>{{ bill.meterEnd - bill.meterStart }} kWh</span>
                        <span class="text-xs text-gray-400">({{ formatCurrency(bill.usageCost) }})</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-beaker" class="w-4 h-4 text-blue-500" />
                        <span class="text-xs">Air: {{ formatCurrency(bill.waterFee) }}</span>
                      </div>
                      <div v-if="Number(bill.trashFee) > 0" class="flex items-center gap-2">
                        <UIcon name="i-heroicons-trash" class="w-4 h-4 text-green-500" />
                        <span class="text-xs">Sampah: {{ formatCurrency(bill.trashFee) }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="p-3 text-right font-bold">{{ formatCurrency(bill.totalAmount) }}</td>
                  <td class="p-3 text-center">
                    <UBadge :color="bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                      {{ bill.isPaid ? 'Lunas' : 'Belum Bayar' }}
                    </UBadge>
                  </td>
                  <td class="p-3 text-center">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-document-arrow-down"
                      :loading="downloadingBillId === bill.id"
                      @click="downloadUtilityReceipt(bill.id)"
                    >
                      Download
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
