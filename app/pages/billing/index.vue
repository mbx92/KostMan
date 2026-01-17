<script setup lang="ts">
import { useKosStore, type RentBill, type UtilityBill } from '~/stores/kos'
import { usePdfReceipt } from '~/composables/usePdfReceipt'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import DatePicker from '~/components/DatePicker.vue'

const store = useKosStore()
const toast = useToast()

const { rentBills, rentBillsLoading, utilityBills, utilityBillsLoading, rooms, properties, settings, meterReadings, tenants } = storeToRefs(store)
const { generateRentReceipt, generateUtilityReceipt, generateCombinedReceipt } = usePdfReceipt()

// Confirm Dialog
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Fetch data on mount
onMounted(async () => {
  await Promise.all([
    store.fetchRentBills(),
    store.fetchUtilityBills(),
    store.fetchRooms(),
    store.fetchProperties(),
    store.fetchSettings(),
    store.fetchTenants()
  ])
})

// Tab state
const activeTab = ref<'rent' | 'utility' | 'summary'>('rent')

// Filters
const selectedPropertyId = ref('all')
const selectedRoomId = ref('all')
const selectedStatus = ref<'all' | 'paid' | 'unpaid'>('all')

const propertyOptions = computed(() => [
  { label: 'All Properties', value: 'all' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

const roomOptions = computed(() => {
  const baseRooms = selectedPropertyId.value !== 'all'
    ? rooms.value.filter(r => r.propertyId === selectedPropertyId.value)
    : rooms.value
  return [
    { label: 'All Rooms', value: 'all' },
    ...baseRooms.map(r => ({ label: r.name, value: r.id }))
  ]
})

// Filtered Bills
const selectedPeriod = ref<string | null>(null)

const filteredRentBills = computed(() => {
  let result = [...rentBills.value]
  if (selectedRoomId.value !== 'all') {
    result = result.filter(b => b.roomId === selectedRoomId.value)
  } else if (selectedPropertyId.value !== 'all') {
    const roomIds = rooms.value.filter(r => r.propertyId === selectedPropertyId.value).map(r => r.id)
    result = result.filter(b => roomIds.includes(b.roomId))
  }
  
  if (selectedPeriod.value) {
    const filterPeriod = selectedPeriod.value.slice(0, 7)
    result = result.filter(b => b.period.startsWith(filterPeriod))
  }

  if (selectedStatus.value === 'paid') result = result.filter(b => b.isPaid)
  if (selectedStatus.value === 'unpaid') result = result.filter(b => !b.isPaid)
  return result.sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
})

const filteredUtilityBills = computed(() => {
  let result = [...utilityBills.value]
  if (selectedRoomId.value !== 'all') {
    result = result.filter(b => b.roomId === selectedRoomId.value)
  } else if (selectedPropertyId.value !== 'all') {
    const roomIds = rooms.value.filter(r => r.propertyId === selectedPropertyId.value).map(r => r.id)
    result = result.filter(b => roomIds.includes(b.roomId))
  }

  // Filter by period (YYYY-MM)
  if (selectedPeriod.value) {
     const filterPeriod = selectedPeriod.value.slice(0, 7)
     result = result.filter(b => b.period.startsWith(filterPeriod))
  }

  if (selectedStatus.value === 'paid') result = result.filter(b => b.isPaid)
  if (selectedStatus.value === 'unpaid') result = result.filter(b => !b.isPaid)
  return result.sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
})

const combinedBills = computed(() => {
  const map = new Map<string, { period: string, roomId: string, rent?: RentBill, util?: UtilityBill }>()

  filteredRentBills.value.forEach(b => {
      const key = `${b.roomId}-${b.period}`
      if (!map.has(key)) map.set(key, { period: b.period, roomId: b.roomId })
      map.get(key)!.rent = b
  })
  
  filteredUtilityBills.value.forEach(b => {
      const key = `${b.roomId}-${b.period}`
      if (!map.has(key)) map.set(key, { period: b.period, roomId: b.roomId })
      map.get(key)!.util = b
  })
  
  return Array.from(map.values())
    .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
})

// Stats
const totalUnpaidRent = computed(() => filteredRentBills.value.filter(b => !b.isPaid).reduce((sum, b) => sum + Number(b.totalAmount), 0))
const totalUnpaidUtility = computed(() => filteredUtilityBills.value.filter(b => !b.isPaid).reduce((sum, b) => sum + Number(b.totalAmount), 0))
const totalUnpaid = computed(() => totalUnpaidRent.value + totalUnpaidUtility.value)

// Generate Rent Bill Form
const isGenerating = ref(false)
const genRoomId = ref('')
const genPeriod = ref(new Date().toISOString().slice(0, 7))
const genMonthsCovered = ref(1)

const genRoom = computed(() => rooms.value.find(r => r.id === genRoomId.value))

const generateRentBill = async () => {
  if (!genRoomId.value || !genRoom.value) return
  try {
    await store.generateRentBill({
      roomId: genRoomId.value,
      period: genPeriod.value.slice(0, 7),
      monthsCovered: genMonthsCovered.value,
      roomPrice: Number(genRoom.value.price)
    })
    await store.fetchRentBills() // Refresh list to get enriched data
    toast.add({ title: 'Success', description: 'Rent bill generated.', color: 'success' })
    isGenerating.value = false
    genRoomId.value = ''
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to generate', color: 'error' })
  }
}

// Actions
const markRentPaid = async (id: string) => {
  try {
    await store.markRentBillAsPaid(id)
    toast.add({ title: 'Paid', description: 'Rent bill marked as paid.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message, color: 'error' })
  }
}

const deleteRent = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Rent Bill?',
    message: 'Data rent bill ini akan dihapus permanen. Lanjutkan?',
    confirmText: 'Hapus',
    confirmColor: 'error'
  })
  if (confirmed) {
    try {
      await store.deleteRentBill(id)
      toast.add({ title: 'Deleted', description: 'Rent bill deleted.', color: 'success' })
    } catch (e: any) {
      toast.add({ title: 'Error', description: e?.data?.message || e?.message, color: 'error' })
    }
  }
}

const markUtilityPaid = async (id: string) => {
  try {
    await store.markUtilityBillAsPaid(id)
    toast.add({ title: 'Paid', description: 'Utility bill marked as paid.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message, color: 'error' })
  }
}

const deleteUtility = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Utility Bill?',
    message: 'Data utility bill ini akan dihapus permanen. Lanjutkan?',
    confirmText: 'Hapus',
    confirmColor: 'error'
  })
  if (confirmed) {
    try {
      await store.deleteUtilityBill(id)
      toast.add({ title: 'Deleted', description: 'Utility bill deleted.', color: 'success' })
    } catch (e: any) {
      toast.add({ title: 'Error', description: e?.data?.message || e?.message, color: 'error' })
    }
  }
}

// Print Actions
const printRent = (bill: RentBill) => {
  const room = rooms.value.find(r => r.id === bill.roomId)
  const prop = properties.value.find(p => p.id === room?.propertyId)
  if (!room || !prop) return
  const tenant = tenants.value.find(t => t.id === room.tenantId) || null
  generateRentReceipt(bill, room, prop, tenant)
}

const printUtility = (bill: UtilityBill) => {
  const room = rooms.value.find(r => r.id === bill.roomId)
  const prop = properties.value.find(p => p.id === room?.propertyId)
  if (!room || !prop) return
  const tenant = tenants.value.find(t => t.id === room.tenantId) || null
  generateUtilityReceipt(bill, room, prop, tenant)
}

const printCombined = (item: { rent?: RentBill, util?: UtilityBill, roomId: string }) => {
  const room = rooms.value.find(r => r.id === item.roomId)
  const prop = properties.value.find(p => p.id === room?.propertyId)
  if (!room || !prop) return
  const tenant = tenants.value.find(t => t.id === room.tenantId) || null
  generateCombinedReceipt(item.rent || null, item.util || null, room, prop, tenant)
}

// Helpers
const formatCurrency = (val: number | string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(val))
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-banknotes" class="w-8 h-8 text-primary-500" />
           Billing
        </h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage rent and utility bills.</p>
      </div>
      <UButton @click="isGenerating = !isGenerating" color="primary" icon="i-heroicons-plus">
        Generate Rent Bill
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Total Unpaid</div>
        <div class="text-3xl font-bold text-red-500 mt-1">{{ formatCurrency(totalUnpaid) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Unpaid Rent</div>
        <div class="text-2xl font-bold text-orange-500 mt-1">{{ formatCurrency(totalUnpaidRent) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Unpaid Utility</div>
        <div class="text-2xl font-bold text-yellow-500 mt-1">{{ formatCurrency(totalUnpaidUtility) }}</div>
      </div>
    </div>



    <!-- Filters -->
    <div class="flex flex-wrap gap-4 items-center">
      <DatePicker v-model="selectedPeriod" granularity="month" class="w-40" placeholder="Semua Periode" />
      <USelect v-model="selectedPropertyId" :items="propertyOptions" value-key="value" label-key="label" class="w-48" />
      <USelect v-model="selectedRoomId" :items="roomOptions" value-key="value" label-key="label" class="w-48" />
      <div class="flex gap-1">
        <UButton :color="selectedStatus === 'all' ? 'primary' : 'neutral'" variant="soft" @click="selectedStatus = 'all'">All</UButton>
        <UButton :color="selectedStatus === 'unpaid' ? 'primary' : 'neutral'" variant="soft" @click="selectedStatus = 'unpaid'">Unpaid</UButton>
        <UButton :color="selectedStatus === 'paid' ? 'primary' : 'neutral'" variant="soft" @click="selectedStatus = 'paid'">Paid</UButton>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
      <UButton :color="activeTab === 'rent' ? 'primary' : 'neutral'" variant="soft" @click="activeTab = 'rent'">
        Rent Bills ({{ filteredRentBills.length }})
      </UButton>
      <UButton :color="activeTab === 'utility' ? 'primary' : 'neutral'" variant="soft" @click="activeTab = 'utility'">
        Utility Bills ({{ filteredUtilityBills.length }})
      </UButton>
      <UButton :color="activeTab === 'summary' ? 'primary' : 'neutral'" variant="soft" @click="activeTab = 'summary'">
        Monthly Summary
      </UButton>
    </div>

    <!-- Rent Bills Table -->
    <UCard v-if="activeTab === 'rent'">
      <div v-if="filteredRentBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="p-3 font-medium">Period</th>
              <th class="p-3 font-medium">Property</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium">Months</th>
              <th class="p-3 font-medium">Total</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="bill in filteredRentBills" :key="bill.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td class="p-3 font-medium">{{ bill.period }}{{ bill.periodEnd ? ` - ${bill.periodEnd}` : '' }}</td>
              <td class="p-3 text-gray-500">{{ bill.property?.name || 'Unknown' }}</td>
              <td class="p-3 font-medium">{{ bill.room?.name || 'Unknown' }}</td>
              <td class="p-3">{{ bill.monthsCovered || 1 }}</td>
              <td class="p-3 font-bold text-gray-900 dark:text-white">{{ formatCurrency(bill.totalAmount) }}</td>
              <td class="p-3">
                <UBadge :color="bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                  {{ bill.isPaid ? 'Paid' : 'Unpaid' }}
                </UBadge>
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip text="Mark as Paid" v-if="!bill.isPaid">
                    <UButton size="xs" color="success" variant="soft" icon="i-heroicons-check" @click="markRentPaid(bill.id)" />
                  </UTooltip>
                  <UTooltip text="Print">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-printer" @click="printRent(bill)" />
                  </UTooltip>
                  <UTooltip text="Delete">
                    <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="deleteRent(bill.id)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-gray-500">No rent bills found.</p>
      </div>
    </UCard>

    <!-- Utility Bills Table -->
    <UCard v-if="activeTab === 'utility'">
      <div v-if="filteredUtilityBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="p-3 font-medium">Period</th>
              <th class="p-3 font-medium">Property</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium">Usage</th>
              <th class="p-3 font-medium">Total</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="bill in filteredUtilityBills" :key="bill.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td class="p-3 font-medium">{{ bill.period }}</td>
              <td class="p-3 text-gray-500">{{ bill.property?.name || 'Unknown' }}</td>
              <td class="p-3 font-medium">{{ bill.room?.name || 'Unknown' }}</td>
              <td class="p-3">
                <div>{{ bill.meterEnd - bill.meterStart }} kWh</div>
                <div class="text-xs text-gray-400 font-mono">{{ bill.meterStart }} → {{ bill.meterEnd }}</div>
              </td>
              <td class="p-3 font-bold text-gray-900 dark:text-white">{{ formatCurrency(bill.totalAmount) }}</td>
              <td class="p-3">
                <UBadge :color="bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                  {{ bill.isPaid ? 'Paid' : 'Unpaid' }}
                </UBadge>
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip text="Mark as Paid" v-if="!bill.isPaid">
                    <UButton size="xs" color="success" variant="soft" icon="i-heroicons-check" @click="markUtilityPaid(bill.id)" />
                  </UTooltip>
                  <UTooltip text="Print">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-printer" @click="printUtility(bill)" />
                  </UTooltip>
                  <UTooltip text="Delete">
                    <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="deleteUtility(bill.id)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-gray-500">No utility bills found.</p>
        <p class="text-gray-400 text-sm mt-1">Utility bills are auto-generated when you add meter readings.</p>
      </div>
    </UCard>

    <!-- Combined Statements Table -->
    <UCard v-if="activeTab === 'summary'">
      <div v-if="combinedBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="p-3 font-medium">Period</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium text-right">Rent</th>
              <th class="p-3 font-medium text-right">Utility</th>
              <th class="p-3 font-medium text-right">Total</th>
              <th class="p-3 font-medium text-center">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="item in combinedBills" :key="`${item.roomId}-${item.period}`" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td class="p-3 font-medium">{{ item.period }}</td>
              <td class="p-3 font-medium">
                 <div>{{ item.rent?.room?.name || item.util?.room?.name || 'Unknown' }}</div>
                 <div class="text-xs text-gray-500">{{ item.rent?.property?.name || item.util?.property?.name || 'Unknown' }}</div>
              </td>
              <td class="p-3 text-right">
                <div v-if="item.rent">
                    {{ formatCurrency(item.rent.totalAmount) }}
                    <UIcon v-if="item.rent.isPaid" name="i-heroicons-check-circle" class="w-4 h-4 text-success-500 inline ml-1" />
                    <UIcon v-else name="i-heroicons-clock" class="w-4 h-4 text-warning-500 inline ml-1" />
                </div>
                <div v-else class="text-gray-400">-</div>
              </td>
              <td class="p-3 text-right">
                <div v-if="item.util">
                    {{ formatCurrency(item.util.totalAmount) }}
                    <UIcon v-if="item.util.isPaid" name="i-heroicons-check-circle" class="w-4 h-4 text-success-500 inline ml-1" />
                    <UIcon v-else name="i-heroicons-clock" class="w-4 h-4 text-warning-500 inline ml-1" />
                </div>
                <div v-else class="text-gray-400">-</div>
              </td>
              <td class="p-3 text-right font-bold">
                {{ formatCurrency((Number(item.rent?.totalAmount || 0) + Number(item.util?.totalAmount || 0))) }}
              </td>
              <td class="p-3 text-center">
                 <UBadge 
                    :color="(item.rent?.isPaid !== false && item.util?.isPaid !== false) ? 'success' : ((item.rent?.isPaid || item.util?.isPaid) ? 'warning' : 'error')" 
                    variant="subtle" size="xs">
                    {{ (item.rent?.isPaid !== false && item.util?.isPaid !== false) ? 'PAID' : ((item.rent?.isPaid || item.util?.isPaid) ? 'PARTIAL' : 'UNPAID') }}
                 </UBadge>
              </td>
              <td class="p-3 text-right">
                <UTooltip text="Print Statement">
                    <UButton size="sm" color="primary" variant="soft" icon="i-heroicons-printer" @click="printCombined(item)">Print</UButton>
                </UTooltip>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-gray-500">No data found for summary.</p>
      </div>
    </UCard>
  </div>

    <!-- Generate Rent Bill Modal -->
    <UModal :open="isGenerating" @close="isGenerating = false">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Generate Rent Bill</h3>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="isGenerating = false" />
            </div>
          </template>
          
          <div class="space-y-4 p-1">
            <UFormField label="Room" required>
              <USelect 
                v-model="genRoomId" 
                :items="roomOptions.slice(1)" 
                value-key="value" 
                label-key="label" 
                placeholder="Pilih kamar..." 
                class="w-full" 
              />
            </UFormField>
            
            <UFormField label="Periode Mulai" required>
              <DatePicker v-model="genPeriod" granularity="month" class="w-full" />
            </UFormField>
            
            <UFormField label="Jumlah Bulan">
              <UInput type="number" v-model.number="genMonthsCovered" min="1" max="12" />
            </UFormField>
            
            <!-- Summary Card -->
            <div v-if="genRoom" class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg border border-primary-200 dark:border-primary-800">
              <div class="flex items-center gap-2 mb-3">
                <UIcon name="i-heroicons-calculator" class="w-5 h-5 text-primary-500" />
                <span class="font-semibold text-primary-700 dark:text-primary-300">Ringkasan Tagihan</span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Harga per Bulan:</span>
                  <span class="font-medium">{{ formatCurrency(genRoom.price) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Durasi:</span>
                  <span class="font-medium">{{ genMonthsCovered }} Bulan</span>
                </div>
                <div class="border-t border-primary-200 dark:border-primary-700 pt-2 mt-2">
                  <div class="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(Number(genRoom.price) * genMonthsCovered) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="isGenerating = false">Batal</UButton>
              <UButton 
                @click="generateRentBill" 
                color="primary" 
                :disabled="!genRoomId" 
                :loading="rentBillsLoading"
                icon="i-heroicons-plus"
              >
                Buat Tagihan
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Confirm Dialog -->
    <ConfirmDialog ref="confirmDialog" />

</template>
