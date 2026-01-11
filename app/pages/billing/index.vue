<script setup lang="ts">
import { useKosStore, type Bill } from '~/stores/kos'

const store = useKosStore()
const toast = useToast()

const { bills, rooms, properties, settings, meterReadings } = storeToRefs(store)

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

const filteredBills = computed(() => {
  let result = [...bills.value]
  
  if (selectedRoomId.value !== 'all') {
    result = result.filter(b => b.roomId === selectedRoomId.value)
  } else if (selectedPropertyId.value !== 'all') {
    const propertyRoomIds = rooms.value
      .filter(r => r.propertyId === selectedPropertyId.value)
      .map(r => r.id)
    result = result.filter(b => propertyRoomIds.includes(b.roomId))
  }
  
  if (selectedStatus.value === 'paid') {
    result = result.filter(b => b.isPaid)
  } else if (selectedStatus.value === 'unpaid') {
    result = result.filter(b => !b.isPaid)
  }
  
  return result.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
})

// Stats
const totalUnpaid = computed(() => 
  bills.value.filter(b => !b.isPaid).reduce((sum, b) => sum + b.totalAmount, 0)
)
const thisMonthIncome = computed(() => {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return bills.value
    .filter(b => b.isPaid && b.period === thisMonth)
    .reduce((sum, b) => sum + b.totalAmount, 0)
})

// Bill Generation
const isGenerating = ref(false)
const genRoomId = ref('')
const genPeriod = ref(new Date().toISOString().slice(0, 7))

const genRoom = computed(() => rooms.value.find(r => r.id === genRoomId.value))
const genProperty = computed(() => properties.value.find(p => p.id === genRoom.value?.propertyId))
const genEffectiveSettings = computed(() => genProperty.value?.settings || settings.value)
const genRoomReadings = computed(() => store.getMeterReadingsByRoomId(genRoomId.value))

const genMeterStart = computed(() => genRoomReadings.value[0]?.meterStart || 0)
const genMeterEnd = computed(() => genRoomReadings.value[0]?.meterEnd || 0)
const genUsage = computed(() => Math.max(0, genMeterEnd.value - genMeterStart.value))
const genElectricityCost = computed(() => genUsage.value * genEffectiveSettings.value.costPerKwh)
const genWaterCost = computed(() => genEffectiveSettings.value.waterFee)
const genTrashCost = computed(() => genRoom.value?.useTrashService !== false ? genEffectiveSettings.value.trashFee : 0)
const genAdditionalCost = computed(() => genWaterCost.value + genTrashCost.value)

// Proration based on move-in date
const genProration = computed(() => {
  if (!genRoom.value?.moveInDate) return 1
  const moveIn = new Date(genRoom.value.moveInDate)
  const periodDate = new Date(genPeriod.value + '-01')
  
  // If move-in is before the billing period, full month
  if (moveIn < periodDate) return 1
  
  // If move-in is in the billing period, prorate
  if (moveIn.getFullYear() === periodDate.getFullYear() && moveIn.getMonth() === periodDate.getMonth()) {
    const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate()
    const daysOccupied = daysInMonth - moveIn.getDate() + 1
    return daysOccupied / daysInMonth
  }
  
  // If move-in is after billing period (shouldn't happen normally)
  return 0
})

const genBaseRent = computed(() => Math.round((genRoom.value?.price || 0) * genProration.value))
const genTotal = computed(() => genBaseRent.value + genElectricityCost.value + genAdditionalCost.value)

const generateBill = () => {
  if (!genRoomId.value) {
    toast.add({ title: 'Select a Room', description: 'Please select a room to generate a bill for.', color: 'warning' })
    return
  }
  if (genMeterEnd.value < genMeterStart.value) {
    toast.add({ title: 'Invalid Readings', description: 'End reading must be >= start reading.', color: 'error' })
    return
  }
  
  try {
    store.generateBill({
      roomId: genRoomId.value,
      period: genPeriod.value,
      meterStart: genMeterStart.value,
      meterEnd: genMeterEnd.value,
      costPerKwh: genEffectiveSettings.value.costPerKwh,
      additionalCost: genAdditionalCost.value
    })
    toast.add({ title: 'Bill Generated', description: `Bill for ${genPeriod.value} created successfully.`, color: 'success' })
    isGenerating.value = false
    genRoomId.value = ''
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
}

// Actions
const markPaid = (id: string) => store.markBillAsPaid(id)
const deleteBill = (id: string) => {
  if (confirm('Delete this bill?')) store.deleteBill(id)
}

// Bill Detail View
const selectedBillId = ref<string | null>(null)
const selectedBill = computed(() => bills.value.find(b => b.id === selectedBillId.value))
const selectedBillRoom = computed(() => rooms.value.find(r => r.id === selectedBill.value?.roomId))
const selectedBillProperty = computed(() => properties.value.find(p => p.id === selectedBillRoom.value?.propertyId))

// Modal state wrapper
const isModalOpen = ref(false)

const viewBill = (id: string) => {
  selectedBillId.value = id
  isModalOpen.value = true
}

const markSelectedPaid = () => {
  if (selectedBillId.value) {
    markPaid(selectedBillId.value)
    toast.add({ title: 'Bill Paid', description: 'Bill has been marked as paid.', color: 'success' })
  }
}

// Helpers
const getRoomName = (roomId: string) => rooms.value.find(r => r.id === roomId)?.name || 'Unknown'
const getPropertyName = (roomId: string) => {
  const room = rooms.value.find(r => r.id === roomId)
  return properties.value.find(p => p.id === room?.propertyId)?.name || 'Unknown'
}
const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
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
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage bills across all properties.</p>
      </div>
      <UButton @click="isGenerating = !isGenerating" color="primary" icon="i-heroicons-plus">
        Generate Bill
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Total Unpaid</div>
        <div class="text-3xl font-bold text-red-500 mt-1">{{ formatCurrency(totalUnpaid) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">This Month's Income</div>
        <div class="text-3xl font-bold text-green-500 mt-1">{{ formatCurrency(thisMonthIncome) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">Total Bills</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ bills.length }}</div>
      </div>
    </div>

    <!-- Generate Bill Form -->
    <UCard v-if="isGenerating" class="border-primary-500 border-2">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-document-plus" class="text-primary-500" />
            Generate New Bill
          </h3>
          <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="isGenerating = false" />
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="space-y-5">
          <div class="space-y-1">
            <label class="text-sm font-medium">Room</label>
            <USelect v-model="genRoomId" :items="roomOptions.slice(1)" value-key="value" label-key="label" placeholder="Select room..." class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Period</label>
            <DatePicker v-model="genPeriod" granularity="month" class="w-full" />
          </div>

          <div v-if="genRoom" class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Meter Start:</span>
              <span class="font-medium">{{ genMeterStart }} kWh</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Meter End:</span>
              <span class="font-medium">{{ genMeterEnd }} kWh</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Usage:</span>
              <span class="font-medium">{{ genUsage }} kWh</span>
            </div>
            <div v-if="genProration < 1" class="flex justify-between text-orange-500">
              <span>Proration:</span>
              <span class="font-medium">{{ Math.round(genProration * 100) }}%</span>
            </div>
          </div>

          <UButton @click="generateBill" block color="primary" size="lg" :disabled="!genRoomId">
            Generate Bill
          </UButton>
        </div>

        <!-- Preview -->
        <div v-if="genRoom" class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
          <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Bill Preview</h4>
          <div class="space-y-3">
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600 dark:text-gray-400">Base Rent {{ genProration < 1 ? `(${Math.round(genProration * 100)}%)` : '' }}</span>
              <span class="font-medium">{{ formatCurrency(genBaseRent) }}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600 dark:text-gray-400">Electricity ({{ genUsage }} kWh)</span>
              <span class="font-medium">{{ formatCurrency(genElectricityCost) }}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600 dark:text-gray-400">Water</span>
              <span class="font-medium">{{ formatCurrency(genWaterCost) }}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600 dark:text-gray-400">Trash</span>
              <span class="font-medium">{{ formatCurrency(genTrashCost) }}</span>
            </div>
            <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
            <div class="flex justify-between items-center text-lg font-bold text-gray-900 dark:text-white">
              <span>Total</span>
              <span>{{ formatCurrency(genTotal) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="flex items-center justify-center text-gray-400 text-sm">
          Select a room to preview bill.
        </div>
      </div>
    </UCard>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 items-center">
      <USelect v-model="selectedPropertyId" :items="propertyOptions" value-key="value" label-key="label" class="w-48" />
      <USelect v-model="selectedRoomId" :items="roomOptions" value-key="value" label-key="label" class="w-48" />
      <div class="flex gap-1">
        <UButton :color="selectedStatus === 'all' ? 'primary' : 'neutral'" variant="soft" @click="selectedStatus = 'all'">All</UButton>
        <UButton :color="selectedStatus === 'unpaid' ? 'primary' : 'neutral'" variant="soft" @click="selectedStatus = 'unpaid'">Unpaid</UButton>
        <UButton :color="selectedStatus === 'paid' ? 'primary' : 'neutral'" variant="soft" @click="selectedStatus = 'paid'">Paid</UButton>
      </div>
    </div>

    <!-- Bills Table -->
    <UCard>
      <div v-if="filteredBills.length > 0" class="overflow-x-auto">
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
            <tr v-for="bill in filteredBills" :key="bill.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <td class="p-3 font-medium">{{ bill.period }}</td>
              <td class="p-3 text-gray-500">{{ getPropertyName(bill.roomId) }}</td>
              <td class="p-3 font-medium">{{ getRoomName(bill.roomId) }}</td>
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
                  <UTooltip text="View Details">
                     <UButton size="xs" color="primary" variant="ghost" icon="i-heroicons-eye" @click="viewBill(bill.id)" />
                  </UTooltip>
                  <UTooltip text="Mark as Paid" v-if="!bill.isPaid">
                    <UButton size="xs" color="success" variant="soft" icon="i-heroicons-check" @click="markPaid(bill.id)" />
                  </UTooltip>
                  <UTooltip text="Delete">
                    <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="deleteBill(bill.id)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
        </div>
        <p class="text-gray-500 text-lg">No bills found.</p>
        <p class="text-gray-400 text-sm mt-1">Click "Generate Bill" to create a new one.</p>
      </div>
    </UCard>
    
    <!-- Bill Detail Modal -->
    <UModal 
        v-model:open="isModalOpen" 
        :ui="{ width: 'sm:max-w-xl' }"
        title="Bill Details"
        :description="selectedBill ? `Period: ${selectedBill.period}` : ''"
    >
        <template #content>
            <div v-if="selectedBill" class="p-6 space-y-6">
                <!-- Header / Summary Badge -->
                <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white">Transaction Summary</div>
                        <div class="text-xs text-gray-500">ID: #{{ selectedBill.id.slice(0, 8) }}</div>
                    </div>
                     <UBadge :color="selectedBill.isPaid ? 'success' : 'warning'" size="md" variant="subtle">
                        {{ selectedBill.isPaid ? 'PAID' : 'UNPAID' }}
                    </UBadge>
                </div>

                <!-- Property Info -->
                <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                    <div class="bg-white dark:bg-gray-900 p-2 rounded-md shadow-sm">
                        <UIcon name="i-heroicons-home-modern" class="w-6 h-6 text-primary-500" />
                    </div>
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white">{{ selectedBillRoom?.name }}</div>
                        <div class="text-xs text-gray-500">{{ selectedBillProperty?.name }}</div>
                    </div>
                </div>

                <!-- Meter Details -->
                <div class="grid grid-cols-3 gap-4 text-center">
                    <div class="bg-primary-50 dark:bg-primary-950/20 p-3 rounded-lg">
                        <div class="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase">Start</div>
                        <div class="font-bold text-gray-900 dark:text-white">{{ selectedBill.meterStart }}</div>
                    </div>
                     <div class="bg-primary-50 dark:bg-primary-950/20 p-3 rounded-lg">
                        <div class="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase">End</div>
                        <div class="font-bold text-gray-900 dark:text-white">{{ selectedBill.meterEnd }}</div>
                    </div>
                     <div class="bg-primary-50 dark:bg-primary-950/20 p-3 rounded-lg border border-primary-200 dark:border-primary-800">
                        <div class="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase">Usage</div>
                        <div class="font-bold text-primary-600 dark:text-primary-400">{{ selectedBill.meterEnd - selectedBill.meterStart }} kWh</div>
                    </div>
                </div>

                <!-- Cost Breakdown Table -->
                <div class="space-y-3">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">Cost Breakdown</h4>
                    
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600 dark:text-gray-400">Base Rent</span>
                        <span class="font-medium">{{ formatCurrency((selectedBillRoom?.price || 0)) }}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600 dark:text-gray-400">Electricity Cost</span>
                        <span class="font-medium">{{ formatCurrency(selectedBill.usageCost) }}</span>
                    </div>
                     <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600 dark:text-gray-400">Additional Cost (Water/Trash)</span>
                        <span class="font-medium">{{ formatCurrency(selectedBill.additionalCost) }}</span>
                    </div>
                    
                    <div class="border-t border-gray-200 dark:border-gray-700 my-2 pt-2">
                        <div class="flex justify-between items-center text-lg font-bold text-gray-900 dark:text-white">
                            <span>Total Amount</span>
                            <span>{{ formatCurrency(selectedBill.totalAmount) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <UButton label="Close" color="neutral" variant="ghost" @click="isModalOpen = false" />
                    <UButton v-if="!selectedBill.isPaid" label="Mark as Paid" color="success" icon="i-heroicons-check" @click="markSelectedPaid" />
                    <UButton v-else label="Paid" color="gray" variant="soft" disabled icon="i-heroicons-check-badge" />
                </div>
            </div>
        </template>
    </UModal>
  </div>
</template>
