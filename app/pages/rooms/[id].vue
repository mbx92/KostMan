<script setup lang="ts">
import { useKosStore, type MeterReading, type Room, type UtilityBill } from '~/stores/kos'
import { usePdfReceipt } from '~/composables/usePdfReceipt'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useKosStore()
const toast = useToast()

const roomId = computed(() => route.params.id as string)
const { utilityBills, tenants, properties, settings } = storeToRefs(store)
const { generateUtilityReceipt, generateRentReceipt } = usePdfReceipt()

// Confirm Dialog
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Fetch room from API
const room = ref<Room | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)

const roomUtilityBills = computed(() => store.getUtilityBillsByRoomId(roomId.value))
const roomRentBills = computed(() => store.getRentBillsByRoomId(roomId.value))
const meterReadings = computed(() => store.getMeterReadingsByRoomId(roomId.value))

const billingHistory = computed(() => {
    const utils = roomUtilityBills.value.map(b => ({ ...b, type: 'utility' as const }))
    const rents = roomRentBills.value.map(b => ({ ...b, type: 'rent' as const }))
    return [...utils, ...rents].sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
})

async function loadRoom() {
  isLoading.value = true
  try {
    const data = await store.fetchRoomById(roomId.value)
    if (data) {
      room.value = data
    } else {
      router.push('/rooms')
    }
  } catch {
    router.push('/rooms')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await store.fetchTenants() // Fetch tenants on mount
  await store.fetchProperties() // Fetch properties for settings
  await loadRoom()
  // Fetch meter readings and bills for this room
  await store.fetchMeterReadings(roomId.value)
  await store.fetchUtilityBills({ roomId: roomId.value })
  await store.fetchRentBills({ roomId: roomId.value })
})

// ============ Room Status & Tenant Management ============
const statusOptions = [
  { label: 'Available', value: 'available' },
  { label: 'Occupied', value: 'occupied' },
  { label: 'Maintenance', value: 'maintenance' }
]

const roomStatus = ref<'available' | 'occupied' | 'maintenance'>('available')
const useTrashService = ref(true)
const moveInDate = ref('')
const occupantCount = ref(1)
const selectedTenantId = ref<string | null>(null)
const isCreatingNewTenant = ref(false)
const newTenantName = ref('')
const newTenantContact = ref('')
const newTenantIdCard = ref('')
const isTenantModalOpen = ref(false)

// Get selected tenant name from tenants list
const selectedTenantName = computed(() => {
  if (!selectedTenantId.value) return ''
  const tenant = tenants.value.find(t => t.id === selectedTenantId.value)
  return tenant?.name || room.value?.tenantName || ''
})

// Handle tenant selection from modal
const onTenantSelect = (tenant: any) => {
  if (tenant === null) {
    // User chose to create new tenant
    isCreatingNewTenant.value = true
    selectedTenantId.value = null
  } else {
    selectedTenantId.value = tenant.id
    isCreatingNewTenant.value = false
  }
}

// Sync room data when loaded
watch(room, (r) => {
  if (r) {
    roomStatus.value = r.status
    useTrashService.value = r.useTrashService ?? true
    moveInDate.value = r.moveInDate || ''
    occupantCount.value = r.occupantCount || 1
    // Set tenantId directly from room data
    selectedTenantId.value = r.tenantId || null
  }
}, { immediate: true })

// Watch for "__new__" selection from legacy select (if used elsewhere)
watch(selectedTenantId, (val) => {
  if (val === '__new__') {
    isCreatingNewTenant.value = true
  }
  // Don't reset isCreatingNewTenant to false here - let onTenantSelect handle it
})

const updateRoomStatus = async () => {
  if (!room.value) return
  
  isSaving.value = true
  
  try {
    let tenantId: string | null = null
    let tenantName = ''
    
    if (roomStatus.value === 'occupied') {
      if (isCreatingNewTenant.value && newTenantName.value) {
        // Validation for new tenant
        if (!newTenantContact.value || !newTenantIdCard.value) {
          toast.add({ title: 'Validation Error', description: 'Please fill in contact and KTP number.', color: 'error' })
          isSaving.value = false
          return
        }
        if (newTenantIdCard.value.length !== 16) {
          toast.add({ title: 'Validation Error', description: 'KTP number must be 16 digits.', color: 'error' })
          isSaving.value = false
          return
        }
        
        // Create new tenant via API
        const newTenant = await store.addTenant({
          name: newTenantName.value,
          contact: newTenantContact.value,
          idCardNumber: newTenantIdCard.value,
          status: 'active',
        })
        tenantId = newTenant.id
        tenantName = newTenantName.value
        
        // Reset form
        newTenantName.value = ''
        newTenantContact.value = ''
        newTenantIdCard.value = ''
        isCreatingNewTenant.value = false
        selectedTenantId.value = tenantId
        
        toast.add({ title: 'Tenant Created', description: 'New tenant has been created and assigned.', color: 'success' })
      } else if (selectedTenantId.value && selectedTenantId.value !== '__new__') {
        tenantId = selectedTenantId.value
        const tenant = tenants.value.find(t => t.id === selectedTenantId.value)
        tenantName = tenant?.name || ''
      } else {
        // No tenant selected for occupied - validation error
        toast.add({ title: 'Validation Error', description: 'Please select or create a tenant for occupied room.', color: 'error' })
        isSaving.value = false
        return
      }
    }
    
    await store.updateRoom(roomId.value, {
      status: roomStatus.value,
      tenantId: roomStatus.value === 'occupied' ? tenantId : null,
      tenantName: roomStatus.value === 'occupied' ? tenantName : undefined,
      useTrashService: useTrashService.value,
      moveInDate: roomStatus.value === 'occupied' ? moveInDate.value : null,
      occupantCount: roomStatus.value === 'occupied' ? occupantCount.value : 1
    })
    
    // Reload room to get updated data
    await loadRoom()
    
    toast.add({ title: 'Room Updated', description: 'Room settings have been saved.', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Failed to update room',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

// Remove tenant (check-out)
const removeTenant = async () => {
  if (!room.value) return
  
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Checkout Penghuni?',
    message: `Apakah Anda yakin ingin checkout ${selectedTenantName.value}? Kamar akan diubah ke status "Available".`,
    confirmText: 'Ya, Checkout',
    confirmColor: 'warning'
  })
  
  if (!confirmed) return
  
  isSaving.value = true
  try {
    await store.updateRoom(roomId.value, {
      status: 'available',
      tenantId: null,
      tenantName: undefined,
      moveInDate: null,
      occupantCount: 1
    })
    
    // Update local state
    selectedTenantId.value = null
    roomStatus.value = 'available'
    moveInDate.value = ''
    occupantCount.value = 1
    
    await loadRoom()
    
    toast.add({ title: 'Checkout Berhasil', description: 'Penghuni telah di-checkout dan kamar tersedia.', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Failed to checkout tenant',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

// ============ Meter Reading Form ============
const meterStart = ref(0)
const meterEnd = ref(0)
const newPeriod = ref(new Date().toISOString().slice(0, 7)) // YYYY-MM

// Auto-fill from previous reading
watch(meterReadings, (readings) => {
  if (readings.length > 0) {
    meterStart.value = readings[0].meterEnd
    meterEnd.value = readings[0].meterEnd
  }
}, { immediate: true })

const usage = computed(() => Math.max(0, meterEnd.value - meterStart.value))

const addReading = async () => {
  if (!newPeriod.value) {
    toast.add({ title: 'Invalid Period', description: 'Please select a billing period.', color: 'error' })
    return
  }
  if (meterEnd.value < meterStart.value) {
    toast.add({ title: 'Invalid Reading', description: 'End reading cannot be less than start reading.', color: 'error' })
    return
  }
  try {
    await store.addMeterReading({
      roomId: roomId.value,
      period: newPeriod.value.slice(0, 7),
      meterStart: meterStart.value,
      meterEnd: meterEnd.value
    })
    toast.add({ title: 'Reading Saved', description: `Meter reading for ${newPeriod.value} recorded.`, color: 'success' })
    meterStart.value = meterEnd.value // Next period starts where this one ended
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to add reading', color: 'error' })
  }
}

const deleteReading = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Meter Reading?',
    message: 'Data meter reading ini akan dihapus permanen. Utility bill terkait juga akan terhapus. Lanjutkan?',
    confirmText: 'Hapus',
    confirmColor: 'error'
  })
  if (confirmed) {
    try {
      await store.deleteMeterReading(id)
      toast.add({ title: 'Reading Deleted', description: 'Meter reading has been deleted.', color: 'success' })
    } catch (e: any) {
      toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to delete reading', color: 'error' })
    }
  }
}

// Bill actions
// Bill actions
const deleteBill = async (bill: any) => {
  const isRent = bill.type === 'rent'
  const title = isRent ? 'Hapus Rent Bill?' : 'Hapus Utility Bill?'
  const message = `Data ${isRent ? 'rent' : 'utility'} bill ini akan dihapus permanen. Lanjutkan?`
  
  const confirmed = await confirmDialog.value?.confirm({
    title,
    message,
    confirmText: 'Hapus',
    confirmColor: 'error'
  })
  
  if (confirmed) {
    try {
      if (isRent) {
         await store.deleteRentBill(bill.id)
      } else {
         await store.deleteUtilityBill(bill.id)
      }
      toast.add({ title: 'Bill Deleted', description: 'Bill has been deleted.', color: 'success' })
    } catch (e: any) {
      toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to delete bill', color: 'error' })
    }
  }
}

const markPaid = async (bill: any) => {
  try {
    if (bill.type === 'rent') {
        await store.markRentBillAsPaid(bill.id)
    } else {
        await store.markUtilityBillAsPaid(bill.id)
    }
    toast.add({ title: 'Bill Paid', description: 'Bill has been marked as paid.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to mark as paid', color: 'error' })
  }
}

// Download receipt
const downloadReceipt = (bill: any) => {
  if (!room.value || !property.value) return
  const tenant = tenants.value.find(t => t.id === room.value?.tenantId) || null
  
  if (bill.type === 'rent') {
      generateRentReceipt(bill, room.value, property.value, tenant)
  } else {
      generateUtilityReceipt(bill, room.value, property.value, tenant)
  }
}

// Helpers
const property = computed(() => properties.value.find(p => p.id === room.value?.propertyId))
const effectiveSettings = computed(() => property.value?.settings || settings.value)
const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)

const getStatusColor = (status: string) => {
  switch(status) {
    case 'available': return 'success'
    case 'occupied': return 'primary'
    case 'maintenance': return 'warning'
    default: return 'neutral'
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push(`/properties/${room.value?.propertyId || ''}`)
  }
}
</script>

<template>
  <div v-if="room" class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Navigation & Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
            <UButton @click="goBack" variant="link" color="neutral" icon="i-heroicons-arrow-left" class="p-0 mb-2">
                Back
            </UButton>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ room.name }}</h1>
            <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage room details and meter readings.</p>
        </div>
        <div class="flex items-center gap-3">
             <div class="text-right hidden sm:block">
                <div class="text-sm text-gray-500">Monthly Rent</div>
                <div class="text-xl font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(Number(room.price)) }}</div>
             </div>
             <UBadge :color="getStatusColor(room.status)" size="lg" variant="solid" class="capitalize px-3 py-1.5">
                {{ room.status }}
             </UBadge>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- LEFT COLUMN: kWh Recording & History (8 cols) -->
        <div class="lg:col-span-8 space-y-6">
            
            <!-- Meter Reading Tabs -->
            <UTabs :items="[{ label: 'Record kWh', slot: 'record' }, { label: 'Billing History', slot: 'history' }]" class="w-full">
                
                <!-- Record kWh Tab -->
                <template #record>
                    <UCard class="mt-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <form @submit.prevent="addReading" class="space-y-5">
                                <div class="space-y-1">
                                    <label class="text-sm font-medium">Billing Period</label>
                                    <DatePicker v-model="newPeriod" granularity="month" class="w-full" />
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-1">
                                        <label class="text-sm font-medium">Start (kWh)</label>
                                        <UInput v-model="meterStart" type="number" class="w-full" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-sm font-medium">End (kWh)</label>
                                        <UInput v-model="meterEnd" type="number" class="w-full" />
                                    </div>
                                </div>

                                <div class="bg-primary-50 dark:bg-primary-950/30 p-3 rounded-lg text-sm">
                                    <div class="flex justify-between text-primary-700 dark:text-primary-400">
                                        <span>Usage:</span>
                                        <span class="font-bold">{{ usage }} kWh</span>
                                    </div>
                                </div>
                                
                                <UButton type="submit" block color="primary" size="lg" class="mt-6" icon="i-heroicons-plus">
                                    Save Reading
                                </UButton>
                            </form>

                            <!-- Reading History -->
                            <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                                <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Reading History</h4>
                                <div v-if="meterReadings.length > 0" class="space-y-2 max-h-64 overflow-y-auto">
                                    <div v-for="reading in meterReadings" :key="reading.id" class="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <div>
                                            <div class="font-medium">{{ reading.meterEnd - reading.meterStart }} kWh</div>
                                            <div class="text-xs text-gray-500">{{ reading.period }} • {{ reading.meterStart }} → {{ reading.meterEnd }}</div>
                                        </div>
                                        <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="deleteReading(reading.id)" />
                                    </div>
                                </div>
                                <div v-else class="text-center text-gray-500 text-sm py-8">
                                    No readings recorded yet.
                                </div>
                            </div>
                        </div>
                    </UCard>
                </template>

                <!-- History Tab -->
                <template #history>
                     <UCard class="mt-4">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="font-semibold text-gray-900 dark:text-white">Billing History</h4>
                            <UButton to="/billing" size="sm" color="primary" variant="soft" icon="i-heroicons-arrow-top-right-on-square">
                                Go to Billing
                            </UButton>
                        </div>
                        <div v-if="billingHistory.length > 0">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th class="p-3 font-medium">Type</th>
                                        <th class="p-3 font-medium">Period</th>
                                        <th class="p-3 font-medium">Details</th>
                                        <th class="p-3 font-medium">Total</th>
                                        <th class="p-3 font-medium">Status</th>
                                        <th class="p-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                                    <tr v-for="bill in billingHistory" :key="bill.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                        <td class="p-3">
                                            <UBadge :color="bill.type === 'rent' ? 'primary' : 'warning'" variant="subtle" size="xs">
                                                {{ bill.type === 'rent' ? 'Rent' : 'Utility' }}
                                            </UBadge>
                                        </td>
                                        <td class="p-3 font-medium">{{ bill.period }}</td>
                                        <td class="p-3">
                                            <div v-if="bill.type === 'utility'">
                                                <div>{{ bill.meterEnd - bill.meterStart }} kWh</div>
                                                <div class="text-xs text-gray-400 font-mono">{{ bill.meterStart }} -> {{ bill.meterEnd }}</div>
                                            </div>
                                            <div v-else>
                                                <div>{{ bill.monthsCovered }} Month(s)</div>
                                            </div>
                                        </td>
                                        <td class="p-3 font-bold text-gray-900 dark:text-white">{{ formatCurrency(Number(bill.totalAmount)) }}</td>
                                        <td class="p-3">
                                            <UBadge :color="bill.isPaid ? 'success' : 'neutral'" variant="subtle" size="xs">
                                                {{ bill.isPaid ? 'Paid' : 'Unpaid' }}
                                            </UBadge>
                                        </td>
                                        <td class="p-3 text-right flex justify-end gap-1">
                                            <UTooltip text="Mark as Paid" v-if="!bill.isPaid">
                                                <UButton size="xs" color="success" variant="soft" icon="i-heroicons-check" @click="markPaid(bill)" />
                                            </UTooltip>
                                            <UTooltip text="Print">
                                                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-printer" @click="downloadReceipt(bill)" />
                                            </UTooltip>
                                            <UTooltip text="Delete">
                                                <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="deleteBill(bill)" />
                                            </UTooltip>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-else class="text-center py-12">
                            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                                <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-gray-400" />
                            </div>
                            <p class="text-gray-500 text-sm">No billing history recorded yet.</p>
                            <UButton to="/billing" class="mt-4" size="sm" color="primary" variant="soft">
                                Create Bill in Billing Page
                            </UButton>
                        </div>
                    </UCard>
                </template>
            </UTabs>
        </div>

        <!-- RIGHT COLUMN: Room Settings & Tenant (4 cols) -->
        <div class="lg:col-span-4 space-y-6">
            <!-- Room Settings Card -->
            <UCard class="ring-1 ring-gray-200 dark:ring-gray-800 shadow-sm">
                <template #header>
                    <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-gray-500" />
                        <h3 class="font-semibold text-gray-900 dark:text-white">Room Settings</h3>
                    </div>
                </template>

                <div class="space-y-4">
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                        <USelect 
                          v-model="roomStatus" 
                          :items="statusOptions" 
                          value-key="value" 
                          label-key="label"
                          class="w-full"
                        />
                    </div>

                    <!-- Tenant Management -->
                    <div v-if="roomStatus === 'occupied'" class="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                         <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Tenant</label>
                            
                            <!-- Selected Tenant Display -->
                            <div v-if="selectedTenantId && selectedTenantId !== '__new__'" class="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md space-y-3">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <UAvatar :alt="selectedTenantName" size="sm" class="bg-primary-100 text-primary-600" />
                                        <div>
                                            <div class="text-sm font-medium">{{ selectedTenantName }}</div>
                                            <div v-if="moveInDate" class="text-xs text-gray-500">
                                                Move-in: {{ new Date(moveInDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <UButton variant="soft" color="neutral" icon="i-heroicons-arrow-path" size="xs" @click="isTenantModalOpen = true" class="flex-1">
                                        Ganti Tenant
                                    </UButton>
                                    <UButton variant="soft" color="warning" icon="i-heroicons-arrow-right-start-on-rectangle" size="xs" @click="removeTenant" class="flex-1">
                                        Checkout
                                    </UButton>
                                </div>
                            </div>

                            <!-- Select Tenant Button -->
                            <div v-else-if="!isCreatingNewTenant">
                                <UButton 
                                    block 
                                    variant="outline" 
                                    color="neutral"
                                    icon="i-heroicons-user-plus"
                                    @click="isTenantModalOpen = true"
                                >
                                    Select Tenant
                                </UButton>
                                <p class="text-xs text-gray-500 mt-1">{{ tenants.filter(t => t.status === 'active').length }} active tenant(s) available</p>
                            </div>
                        </div>

                        <!-- New Tenant Form -->
                        <div v-if="isCreatingNewTenant" class="p-4 bg-primary-50 dark:bg-primary-950/30 rounded-lg space-y-3 border border-primary-100 dark:border-primary-900/50">
                            <div class="flex items-center justify-between text-sm font-medium text-primary-700 dark:text-primary-400 mb-2">
                                <span class="flex items-center gap-1"><UIcon name="i-heroicons-user-plus" /> New Tenant</span>
                                <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" size="xs" @click="isCreatingNewTenant = false; selectedTenantId = null" />
                            </div>
                            
                            <UFormField label="Full Name">
                                <UInput v-model="newTenantName" placeholder="e.g. Budi Santoso" size="sm" class="w-full" />
                            </UFormField>
                            <UFormField label="Contact">
                                <UInput v-model="newTenantContact" placeholder="08..." size="sm" class="w-full" />
                            </UFormField>
                            <UFormField label="KTP Number">
                                <UInput v-model="newTenantIdCard" placeholder="16 digits" maxlength="16" size="sm" class="w-full" />
                            </UFormField>
                        </div>

                        <!-- Move-In Date -->
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Move-In Date</label>
                            <DatePicker v-model="moveInDate" class="w-full" />
                            <p class="text-xs text-gray-500">Tanggal masuk penghuni (jatuh tempo tagihan).</p>
                        </div>

                        <!-- Occupant Count -->
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Jumlah Penghuni</label>
                            <UInput v-model.number="occupantCount" type="number" min="1" max="10" class="w-full" />
                            <p class="text-xs text-gray-500">Biaya air dihitung per kepala.</p>
                        </div>
                    </div>

                    <!-- Trash Service Toggle -->
                    <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Trash Service</div>
                                <div class="text-xs text-gray-500">Include trash fee ({{ formatCurrency(Number(effectiveSettings.trashFee)) }}/mo)</div>
                            </div>
                            <USwitch v-model="useTrashService" />
                        </div>
                    </div>

                    <UButton @click="updateRoomStatus" block color="primary" class="mt-4" :loading="isSaving">
                        Save Changes
                    </UButton>
                </div>
            </UCard>
        </div>
    </div>
  </div>

  <!-- Tenant Select Modal -->
  <TenantSelectModal v-model="isTenantModalOpen" @select="onTenantSelect" />
  
  <!-- Confirm Dialog -->
  <ConfirmDialog ref="confirmDialog" />
</template>
