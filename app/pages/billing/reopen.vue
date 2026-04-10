<script setup lang="ts">
import ConfirmDialog from '~/components/ConfirmDialog.vue'

type PaidBillType = 'rent' | 'utility'

interface PaidBillItem {
  id: string
  type: PaidBillType
  period: string
  periodLabel: string
  propertyName: string
  roomName: string
  tenantName: string
  totalAmount: number
  paidAmount: number
  paidAt: string | null
  paymentMethod: string | null
}

const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const selectedPropertyId = ref('all')
const selectedType = ref<'all' | PaidBillType>('all')
const searchQuery = ref('')
const loading = ref(false)
const reopeningId = ref<string | null>(null)

const { data: propertiesData } = await useAuthFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])

const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  ...properties.value.map((property: any) => ({ label: property.name, value: property.id })),
])

const rentBills = ref<any[]>([])
const utilityBills = ref<any[]>([])

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value))

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatPeriodMonth = (period?: string | null) => {
  if (!period) return '-'
  const match = period.match(/^(\d{4})-(\d{2})$/)
  if (!match) return period

  const [, year, month] = match
  const date = new Date(Number(year), Number(month) - 1, 1)
  if (Number.isNaN(date.getTime())) return period

  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '-'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return `${start} - ${end}`

  return `${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const paymentMethodLabel = (method?: string | null) => {
  if (!method) return '-'
  const labels: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
  }
  return labels[method] || method
}

const loadPaidBills = async () => {
  loading.value = true
  try {
    const query = selectedPropertyId.value !== 'all' ? `?propertyId=${encodeURIComponent(selectedPropertyId.value)}&isPaid=true` : '?isPaid=true'
    const [rentData, utilityData] = await Promise.all([
      $fetch<any[]>(`/api/rent-bills${query}`),
      $fetch<any[]>(`/api/utility-bills${query}`),
    ])

    rentBills.value = rentData || []
    utilityBills.value = utilityData || []
  } catch (error: any) {
    toast.add({
      title: 'Gagal',
      description: error?.data?.message || error?.message || 'Gagal memuat tagihan lunas',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

watch(selectedPropertyId, loadPaidBills)

onMounted(loadPaidBills)

const allPaidBills = computed<PaidBillItem[]>(() => {
  const rentItems = rentBills.value.map((entry) => ({
    id: entry.bill.id,
    type: 'rent' as const,
    period: entry.bill.period || entry.bill.periodStartDate || '',
    periodLabel: formatDateRange(entry.bill.periodStartDate, entry.bill.periodEndDate),
    propertyName: entry.property?.name || '-',
    roomName: entry.room?.name || '-',
    tenantName: entry.tenant?.name || entry.room?.tenantName || '-',
    totalAmount: Number(entry.bill.totalAmount || 0),
    paidAmount: Number(entry.bill.paidAmount || 0),
    paidAt: entry.bill.paidAt,
    paymentMethod: entry.bill.paymentMethod,
  }))

  const utilityItems = utilityBills.value.map((entry) => ({
    id: entry.bill.id,
    type: 'utility' as const,
    period: entry.bill.period || '',
    periodLabel: formatPeriodMonth(entry.bill.period),
    propertyName: entry.property?.name || '-',
    roomName: entry.room?.name || '-',
    tenantName: entry.tenant?.name || entry.room?.tenantName || '-',
    totalAmount: Number(entry.bill.totalAmount || 0),
    paidAmount: Number(entry.bill.paidAmount || 0),
    paidAt: entry.bill.paidAt,
    paymentMethod: entry.bill.paymentMethod,
  }))

  return [...rentItems, ...utilityItems].sort((a, b) => {
    const aDate = a.paidAt ? new Date(a.paidAt).getTime() : 0
    const bDate = b.paidAt ? new Date(b.paidAt).getTime() : 0
    return bDate - aDate
  })
})

const filteredBills = computed(() => {
  const search = searchQuery.value.trim().toLowerCase()

  return allPaidBills.value.filter((bill) => {
    if (selectedType.value !== 'all' && bill.type !== selectedType.value) {
      return false
    }

    if (!search) return true

    return [bill.propertyName, bill.roomName, bill.tenantName, bill.periodLabel, bill.type]
      .some((value) => value.toLowerCase().includes(search))
  })
})

const stats = computed(() => ({
  total: filteredBills.value.length,
  rent: filteredBills.value.filter((bill) => bill.type === 'rent').length,
  utility: filteredBills.value.filter((bill) => bill.type === 'utility').length,
}))

const reopenBill = async (bill: PaidBillItem) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Reopen tagihan?',
    message: `Tagihan ${bill.type === 'rent' ? 'sewa' : 'utilitas'} untuk ${bill.roomName} akan dibuka ulang. Semua histori pembayaran pada tagihan ini akan dihapus.`,
    confirmText: 'Ya, Reopen',
    confirmColor: 'warning',
  })

  if (!confirmed) return

  reopeningId.value = bill.id
  try {
    const endpoint = bill.type === 'rent'
      ? `/api/rent-bills/${bill.id}/reopen`
      : `/api/utility-bills/${bill.id}/reopen`

    const response = await $fetch<{ deletedPayments: number }>(endpoint, { method: 'PATCH' })

    toast.add({
      title: 'Berhasil',
      description: `Tagihan dibuka ulang. ${response.deletedPayments || 0} histori pembayaran dihapus.`,
      color: 'success',
    })

    await loadPaidBills()
  } catch (error: any) {
    toast.add({
      title: 'Gagal',
      description: error?.data?.statusMessage || error?.data?.message || error?.message || 'Gagal reopen tagihan',
      color: 'error',
    })
  } finally {
    reopeningId.value = null
  }
}
</script>

<template>
  <div class="p-4 sm:p-8 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Reopen Tagihan</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Buka ulang tagihan yang sudah lunas dan hapus histori pembayarannya.</p>
      </div>
      <div class="flex gap-3">
        <UButton
          to="/billing"
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-left"
        >
          Kembali ke Tagihan
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          :loading="loading"
          @click="loadPaidBills"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 dark:text-gray-400">Total Tagihan Lunas</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ stats.total }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 dark:text-gray-400">Tagihan Sewa</div>
        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ stats.rent }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 dark:text-gray-400">Tagihan Utilitas</div>
        <div class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ stats.utility }}</div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <USelect
          v-model="selectedPropertyId"
          :items="propertyOptions"
          value-key="value"
          label-key="label"
        />
        <USelect
          v-model="selectedType"
          :items="[
            { label: 'Semua Tipe', value: 'all' },
            { label: 'Sewa', value: 'rent' },
            { label: 'Utilitas', value: 'utility' },
          ]"
          value-key="value"
          label-key="label"
        />
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Cari kamar, penghuni, periode..."
        />
      </div>
    </div>

    <div class="hidden md:block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Periode</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kamar</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Properti</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nominal</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dibayar</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="loading">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto" />
              </td>
            </tr>
            <tr v-else-if="filteredBills.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                Tidak ada tagihan lunas yang cocok dengan filter.
              </td>
            </tr>
            <tr v-for="bill in filteredBills" :key="`${bill.type}-${bill.id}`" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="px-6 py-4 whitespace-nowrap">
                <UBadge :color="bill.type === 'rent' ? 'info' : 'warning'" variant="subtle">
                  {{ bill.type === 'rent' ? 'Sewa' : 'Utilitas' }}
                </UBadge>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{{ bill.periodLabel }}</td>
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900 dark:text-white">{{ bill.roomName }}</div>
                <div class="text-xs text-gray-500">{{ bill.tenantName }}</div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{{ bill.propertyName }}</td>
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900 dark:text-white">{{ formatCurrency(bill.totalAmount) }}</div>
                <div class="text-xs text-gray-500">paidAmount: {{ formatCurrency(bill.paidAmount) }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm text-gray-900 dark:text-white">{{ formatDate(bill.paidAt) }}</div>
                <div class="text-xs text-gray-500">{{ paymentMethodLabel(bill.paymentMethod) }}</div>
              </td>
              <td class="px-6 py-4 text-right">
                <UButton
                  color="warning"
                  variant="soft"
                  icon="i-heroicons-arrow-uturn-left"
                  :loading="reopeningId === bill.id"
                  @click="reopenBill(bill)"
                >
                  Reopen
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="md:hidden space-y-3">
      <div v-if="loading" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto text-gray-500" />
      </div>
      <div v-else-if="filteredBills.length === 0" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
        Tidak ada tagihan lunas yang cocok dengan filter.
      </div>
      <div v-for="bill in filteredBills" :key="`${bill.type}-${bill.id}`" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <UBadge :color="bill.type === 'rent' ? 'info' : 'warning'" variant="subtle">
                {{ bill.type === 'rent' ? 'Sewa' : 'Utilitas' }}
              </UBadge>
              <span class="text-sm text-gray-500">{{ bill.periodLabel }}</span>
            </div>
            <div class="mt-2 font-semibold text-gray-900 dark:text-white">{{ bill.roomName }}</div>
            <div class="text-sm text-gray-500">{{ bill.tenantName }} · {{ bill.propertyName }}</div>
          </div>
          <UButton
            color="warning"
            variant="soft"
            size="sm"
            icon="i-heroicons-arrow-uturn-left"
            :loading="reopeningId === bill.id"
            @click="reopenBill(bill)"
          >
            Reopen
          </UButton>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-gray-500">Nominal</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(bill.totalAmount) }}</div>
          </div>
          <div>
            <div class="text-gray-500">Dibayar</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ formatDate(bill.paidAt) }}</div>
          </div>
          <div>
            <div class="text-gray-500">paidAmount</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(bill.paidAmount) }}</div>
          </div>
          <div>
            <div class="text-gray-500">Metode</div>
            <div class="font-medium text-gray-900 dark:text-white">{{ paymentMethodLabel(bill.paymentMethod) }}</div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>