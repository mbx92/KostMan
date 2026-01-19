<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import DatePicker from '~/components/DatePicker.vue'

// Types
interface Bill {
  id: string
  billingCode: string
  billType: 'rent' | 'utility'
  roomId: string
  tenantId: string
  billStatus: 'draft' | 'unpaid' | 'paid'
  periodStart: string
  periodEnd: string
  monthsCovered: number
  totalChargedAmount: number
  notes?: string
  room?: any
  tenant?: any
  details?: BillingDetail[]
  payments?: Payment[]
  totalPaid?: number
  balance?: number
}

interface BillingDetail {
  id: string
  itemType: 'rent' | 'utility' | 'others'
  itemName: string
  itemQty: number
  itemUnitPrice: number
  itemTotalAmount: number
}

interface Payment {
  id: string
  paymentMethod: 'cash' | 'online'
  paymentAmount: number
  paymentDate: string
}

// State
const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const bills = ref<Bill[]>([])
const loading = ref(false)
const rooms = ref<any[]>([])
const tenants = ref<any[]>([])

// Filters
const selectedStatus = ref<'all' | 'draft' | 'unpaid' | 'paid'>('all')
const selectedRoomId = ref('all')
const searchQuery = ref('')

// Generate Bill Modal
const showGenerateModal = ref(false)
const generateForm = ref({
  roomId: '',
  tenantId: '',
  periodStart: new Date().toISOString().split('T')[0],
  periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  includeUtility: true, // Flag to include/exclude utility charges
  notes: '',
  additionalCharges: [] as Array<{
    itemName: string
    itemQty: number
    itemUnitPrice: number
    itemDiscount: number
    notes?: string
  }>
})

// Payment Modal
const showPaymentModal = ref(false)
const selectedBill = ref<Bill | null>(null)
const paymentForm = ref({
  paymentMethod: 'cash' as 'cash' | 'online',
  paymentAmount: 0,
  paymentDate: new Date().toISOString().split('T')[0],
  paymentProof: '',
  notes: ''
})

// Detail Modal
const showDetailModal = ref(false)
const detailBill = ref<Bill | null>(null)

// Edit Detail Modal
const showEditDetailModal = ref(false)
const editingDetail = ref<any>(null)
const editDetailForm = ref({
  itemName: '',
  itemQty: 1,
  itemUnitPrice: 0,
  itemDiscount: 0,
  notes: ''
})

// Add Detail Modal
const showAddDetailModal = ref(false)
const addDetailForm = ref({
  itemType: 'others' as 'rent' | 'utility' | 'others',
  itemName: '',
  itemQty: 1,
  itemUnitPrice: 0,
  itemDiscount: 0,
  notes: ''
})

// Edit Period Modal
const showEditPeriodModal = ref(false)
const editPeriodForm = ref({
  periodStart: '',
  periodEnd: ''
})

// Generate Utility Bill Modal
const showGenerateUtilityModal = ref(false)
const generateUtilityForm = ref({
  roomId: '',
  tenantId: '',
  periodStart: new Date().toISOString().split('T')[0],
  periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  notes: '',
  utilityItems: [] as Array<{
    itemName: string
    itemQty: number
    itemUnitPrice: number
    itemDiscount: number
    notes?: string
  }>
})

// Fetch data
const fetchBills = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (selectedStatus.value !== 'all') {
      params.billStatus = selectedStatus.value
    }
    if (selectedRoomId.value !== 'all') {
      params.roomId = selectedRoomId.value
    }

    const { data } = await $fetch<{ success: boolean; data: Bill[] }>('/api/bills', {
      params
    })
    bills.value = data
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to fetch bills',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const fetchRooms = async () => {
  try {
    const { data } = await $fetch<any>('/api/rooms')
    rooms.value = data
  } catch (error) {
    console.error('Failed to fetch rooms:', error)
  }
}

const fetchTenants = async () => {
  try {
    const response = await $fetch<any>('/api/tenants')
    // Handle both array and { data: [...] } formats
    tenants.value = Array.isArray(response) ? response : (response.data || [])
  } catch (error) {
    console.error('Failed to fetch tenants:', error)
  }
}

onMounted(async () => {
  await Promise.all([fetchBills(), fetchRooms(), fetchTenants()])
})

// Computed
const filteredBills = computed(() => {
  let result = bills.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      b =>
        b.billingCode.toLowerCase().includes(query) ||
        b.room?.name?.toLowerCase().includes(query) ||
        b.tenant?.name?.toLowerCase().includes(query)
    )
  }

  return result.sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime())
})

const roomOptions = computed(() => [
  { label: 'All Rooms', value: 'all' },
  ...rooms.value.map(r => ({ label: r.name, value: r.id }))
])

const availableRooms = computed(() => 
  rooms.value.filter(r => r.tenantId)
)

const selectedRoom = computed(() => 
  rooms.value.find(r => r.id === generateForm.value.roomId)
)

const stats = computed(() => ({
  total: filteredBills.value.length,
  draft: filteredBills.value.filter(b => b.billStatus === 'draft').length,
  unpaid: filteredBills.value.filter(b => b.billStatus === 'unpaid').length,
  paid: filteredBills.value.filter(b => b.billStatus === 'paid').length,
  totalUnpaid: filteredBills.value
    .filter(b => b.billStatus === 'unpaid')
    .reduce((sum, b) => sum + b.totalChargedAmount, 0)
}))

// Actions
const generateBill = async () => {
  if (!generateForm.value.roomId || !generateForm.value.tenantId) {
    toast.add({
      title: 'Error',
      description: 'Please select room and tenant',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    await $fetch('/api/bills/generate', {
      method: 'POST',
      body: generateForm.value
    })

    toast.add({
      title: 'Success',
      description: 'Bill generated successfully',
      color: 'success'
    })

    showGenerateModal.value = false
    resetGenerateForm()
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to generate bill',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const generateUtilityBill = async () => {
  if (!generateUtilityForm.value.roomId || !generateUtilityForm.value.tenantId) {
    toast.add({
      title: 'Error',
      description: 'Please select room and tenant',
      color: 'error'
    })
    return
  }

  if (generateUtilityForm.value.utilityItems.length === 0) {
    toast.add({
      title: 'Error',
      description: 'Please add at least one utility item',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    // Generate bill with utility items only (no rent, no auto utility lookup)
    await $fetch('/api/bills/generate', {
      method: 'POST',
      body: {
        roomId: generateUtilityForm.value.roomId,
        tenantId: generateUtilityForm.value.tenantId,
        periodStart: generateUtilityForm.value.periodStart,
        periodEnd: generateUtilityForm.value.periodEnd,
        includeRent: false, // Skip rent generation
        includeUtility: false, // Skip auto utility lookup
        notes: generateUtilityForm.value.notes,
        additionalCharges: generateUtilityForm.value.utilityItems.map(item => ({
          ...item,
          itemType: 'utility' // Force type to utility
        }))
      }
    })

    toast.add({
      title: 'Success',
      description: 'Utility bill generated successfully',
      color: 'success'
    })

    showGenerateUtilityModal.value = false
    resetGenerateUtilityForm()
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to generate utility bill',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const addUtilityItem = () => {
  generateUtilityForm.value.utilityItems.push({
    itemName: '',
    itemQty: 1,
    itemUnitPrice: 0,
    itemDiscount: 0
  })
}

const removeUtilityItem = (index: number) => {
  generateUtilityForm.value.utilityItems.splice(index, 1)
}

const resetGenerateUtilityForm = () => {
  generateUtilityForm.value = {
    roomId: '',
    tenantId: '',
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    notes: '',
    utilityItems: []
  }
}

const viewDetail = async (bill: Bill) => {
  loading.value = true
  try {
    const { data } = await $fetch<{ success: boolean; data: Bill }>(`/api/bills/${bill.id}`)
    detailBill.value = data
    showDetailModal.value = true
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to fetch bill details',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const updateBillStatus = async (billId: string, status: 'draft' | 'unpaid' | 'paid') => {
  loading.value = true
  try {
    await $fetch(`/api/bills/${billId}`, {
      method: 'put' as any,
      body: { billStatus: status }
    })

    toast.add({
      title: 'Success',
      description: 'Bill status updated',
      color: 'success'
    })

    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to update bill',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const deleteBill = async (billId: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Delete Bill?',
    message: 'This bill will be permanently deleted. Continue?',
    confirmText: 'Delete',
    confirmColor: 'error'
  })

  if (!confirmed) return

  loading.value = true
  try {
    await $fetch(`/api/bills/${billId}`, {
      method: 'delete' as any
    })

    toast.add({
      title: 'Success',
      description: 'Bill deleted successfully',
      color: 'success'
    })

    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to delete bill',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const openPaymentModal = (bill: Bill) => {
  selectedBill.value = bill
  paymentForm.value.paymentAmount = bill.balance || bill.totalChargedAmount
  showPaymentModal.value = true
}

const recordPayment = async () => {
  if (!selectedBill.value) return

  loading.value = true
  try {
    await $fetch(`/api/bills/${selectedBill.value.id}/payment`, {
      method: 'POST',
      body: paymentForm.value
    })

    toast.add({
      title: 'Success',
      description: 'Payment recorded successfully',
      color: 'success'
    })

    showPaymentModal.value = false
    resetPaymentForm()
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to record payment',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const addAdditionalCharge = () => {
  generateForm.value.additionalCharges.push({
    itemName: '',
    itemQty: 1,
    itemUnitPrice: 0,
    itemDiscount: 0
  })
}

const removeAdditionalCharge = (index: number) => {
  generateForm.value.additionalCharges.splice(index, 1)
}

const resetGenerateForm = () => {
  generateForm.value = {
    roomId: '',
    tenantId: '',
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    includeUtility: true,
    notes: '',
    additionalCharges: []
  }
}

const resetPaymentForm = () => {
  paymentForm.value = {
    paymentMethod: 'cash',
    paymentAmount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentProof: '',
    notes: ''
  }
}

// Detail Management Functions
const openAddDetailModal = (bill: Bill) => {
  selectedBill.value = bill
  showAddDetailModal.value = true
}

const addBillingDetail = async () => {
  if (!selectedBill.value) return

  loading.value = true
  try {
    await $fetch(`/api/bills/${selectedBill.value.id}/details`, {
      method: 'POST',
      body: addDetailForm.value
    })

    toast.add({
      title: 'Success',
      description: 'Billing detail added successfully',
      color: 'success'
    })

    showAddDetailModal.value = false
    resetAddDetailForm()
    
    // Refresh bill details
    if (showDetailModal.value && detailBill.value) {
      await viewDetail(detailBill.value)
    }
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to add billing detail',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const openEditDetailModal = (detail: any) => {
  editingDetail.value = detail
  editDetailForm.value = {
    itemName: detail.itemName,
    itemQty: detail.itemQty,
    itemUnitPrice: detail.itemUnitPrice,
    itemDiscount: detail.itemDiscount || 0,
    notes: detail.notes || ''
  }
  showEditDetailModal.value = true
}

const updateBillingDetail = async () => {
  if (!editingDetail.value) return

  loading.value = true
  try {
    await $fetch(`/api/bills/${detailBill.value?.id}/details/${editingDetail.value.id}`, {
      method: 'put' as any,
      body: editDetailForm.value
    })

    toast.add({
      title: 'Success',
      description: 'Billing detail updated successfully',
      color: 'success'
    })

    showEditDetailModal.value = false
    
    // Refresh bill details
    if (detailBill.value) {
      await viewDetail(detailBill.value)
    }
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to update billing detail',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const deleteBillingDetail = async (detailId: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Delete Billing Detail?',
    message: 'This item will be removed from the bill. Continue?',
    confirmText: 'Delete',
    confirmColor: 'error'
  })

  if (!confirmed) return

  loading.value = true
  try {
    await $fetch(`/api/bills/${detailBill.value?.id}/details/${detailId}`, {
      method: 'delete' as any
    })

    toast.add({
      title: 'Success',
      description: 'Billing detail deleted successfully',
      color: 'success'
    })

    // Refresh bill details
    if (detailBill.value) {
      await viewDetail(detailBill.value)
    }
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to delete billing detail',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const resetAddDetailForm = () => {
  addDetailForm.value = {
    itemType: 'others',
    itemName: '',
    itemQty: 1,
    itemUnitPrice: 0,
    itemDiscount: 0,
    notes: ''
  }
}

// Edit Period Functions
const openEditPeriodModal = (bill: Bill) => {
  selectedBill.value = bill
  editPeriodForm.value = {
    periodStart: bill.periodStart,
    periodEnd: bill.periodEnd
  }
  showEditPeriodModal.value = true
}

const updateBillPeriod = async () => {
  if (!selectedBill.value) return

  loading.value = true
  try {
    await $fetch(`/api/bills/${selectedBill.value.id}/period`, {
      method: 'put' as any,
      body: editPeriodForm.value
    })

    toast.add({
      title: 'Success',
      description: 'Bill period updated and rent charges recalculated',
      color: 'success'
    })

    showEditPeriodModal.value = false
    
    // Refresh bill details
    if (showDetailModal.value && detailBill.value) {
      await viewDetail(detailBill.value)
    }
    await fetchBills()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to update bill period',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Watch room selection to auto-fill tenant
watch(() => generateForm.value.roomId, (roomId) => {
  const room = rooms.value.find(r => r.id === roomId)
  if (room?.tenantId) {
    generateForm.value.tenantId = room.tenantId
  }
})

// Auto generate utility items based on settings and meter readings
const autoGenerateUtilityItems = async () => {
  if (!generateUtilityForm.value.roomId || !generateUtilityForm.value.periodStart || !generateUtilityForm.value.periodEnd) {
    return
  }

  // Only auto-generate if list is empty to avoid overwriting user input
  // Or if triggered explicitly (could allow force refresh later)
  if (generateUtilityForm.value.utilityItems.length > 0) {
    return 
  }

  try {
    const response = await $fetch<{ success: boolean, data: any[] }>('/api/bills/calculate-utility', {
      method: 'POST',
      body: {
        roomId: generateUtilityForm.value.roomId,
        periodStart: generateUtilityForm.value.periodStart,
        periodEnd: generateUtilityForm.value.periodEnd
      }
    })

    if (response.success && response.data.length > 0) {
      generateUtilityForm.value.utilityItems = response.data.map(item => ({
        ...item,
        itemDiscount: item.itemDiscount || 0,
        notes: ''
      }))
      
      toast.add({
        title: 'Items Generated',
        description: `Added ${response.data.length} utility items automatically`,
        color: 'success',
        timeout: 2000
      })
    }
  } catch (error) {
    console.error('Failed to auto-generate utility items', error)
    // Silent fail is generally preferred for auto-actions, or just log
  }
}

// Watch room selection in utility form
watch(() => generateUtilityForm.value.roomId, (roomId) => {
  const room = rooms.value.find(r => r.id === roomId)
  if (room?.tenantId) {
    generateUtilityForm.value.tenantId = room.tenantId
  }
  
  // Clear items when room changes to force regeneration for the new room
  if (roomId) {
    generateUtilityForm.value.utilityItems = []
    autoGenerateUtilityItems()
  }
})

// Helpers
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val)

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft':
      return 'neutral'
    case 'unpaid':
      return 'warning'
    case 'paid':
      return 'success'
    default:
      return 'neutral'
  }
}

const getItemTypeIcon = (type: string) => {
  switch (type) {
    case 'rent':
      return 'i-heroicons-home'
    case 'utility':
      return 'i-heroicons-bolt'
    case 'others':
      return 'i-heroicons-plus-circle'
    default:
      return 'i-heroicons-document'
  }
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-primary-500" />
          Consolidated Billing
        </h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Manage consolidated bills with rent, utilities, and additional charges
        </p>
      </div>
      <div class="flex gap-2">
        <UButton @click="showGenerateModal = true" color="primary" icon="i-heroicons-plus" size="lg">
          Generate Bill
        </UButton>
        <UButton @click="showGenerateUtilityModal = true" color="success" icon="i-heroicons-bolt" size="lg">
          Generate Utility Bill
        </UButton>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Total Bills</p>
            <p class="text-2xl font-bold mt-1">{{ stats.total }}</p>
          </div>
          <UIcon name="i-heroicons-document-duplicate" class="w-10 h-10 text-gray-400" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Unpaid</p>
            <p class="text-2xl font-bold mt-1 text-warning-500">{{ stats.unpaid }}</p>
          </div>
          <UIcon name="i-heroicons-clock" class="w-10 h-10 text-warning-400" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Paid</p>
            <p class="text-2xl font-bold mt-1 text-success-500">{{ stats.paid }}</p>
          </div>
          <UIcon name="i-heroicons-check-circle" class="w-10 h-10 text-success-400" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Total Unpaid</p>
            <p class="text-xl font-bold mt-1 text-red-500">{{ formatCurrency(stats.totalUnpaid) }}</p>
          </div>
          <UIcon name="i-heroicons-banknotes" class="w-10 h-10 text-red-400" />
        </div>
      </UCard>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 items-center">
      <UInput
        v-model="searchQuery"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search bills..."
        class="w-64"
      />
      <USelect
        v-model="selectedRoomId"
        :items="roomOptions"
        value-key="value"
        label-key="label"
        class="w-48"
      />
      <div class="flex gap-1">
        <UButton
          :color="selectedStatus === 'all' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'all'; fetchBills()"
        >
          All
        </UButton>
        <UButton
          :color="selectedStatus === 'draft' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'draft'; fetchBills()"
        >
          Draft
        </UButton>
        <UButton
          :color="selectedStatus === 'unpaid' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'unpaid'; fetchBills()"
        >
          Unpaid
        </UButton>
        <UButton
          :color="selectedStatus === 'paid' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'paid'; fetchBills()"
        >
          Paid
        </UButton>
      </div>
    </div>

    <!-- Bills Table -->
    <UCard>
      <div v-if="loading" class="text-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500 mx-auto" />
        <p class="text-gray-500 mt-2">Loading bills...</p>
      </div>

      <div v-else-if="filteredBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="p-3 font-medium">Bill Code</th>
              <th class="p-3 font-medium">Type</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium">Tenant</th>
              <th class="p-3 font-medium">Period</th>
              <th class="p-3 font-medium">Months</th>
              <th class="p-3 font-medium text-right">Amount</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="bill in filteredBills"
              :key="bill.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <td class="p-3 font-mono text-xs font-medium">{{ bill.billingCode }}</td>
              <td class="p-3">
                <UBadge :color="bill.billType === 'rent' ? 'primary' : 'orange'" variant="subtle" size="xs">
                  {{ bill.billType ? bill.billType.toUpperCase() : 'RENT' }}
                </UBadge>
              </td>
              <td class="p-3">{{ bill.room?.name || 'Unknown' }}</td>
              <td class="p-3">{{ bill.tenant?.name || 'Unknown' }}</td>
              <td class="p-3 text-xs">
                <div>{{ formatDate(bill.periodStart) }}</div>
                <div class="text-gray-400">to {{ formatDate(bill.periodEnd) }}</div>
              </td>
              <td class="p-3">{{ bill.monthsCovered }}</td>
              <td class="p-3 text-right font-bold">{{ formatCurrency(bill.totalChargedAmount) }}</td>
              <td class="p-3">
                <UBadge :color="getStatusColor(bill.billStatus)" variant="subtle" size="xs">
                  {{ bill.billStatus.toUpperCase() }}
                </UBadge>
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip text="View Details">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-heroicons-eye"
                      @click="viewDetail(bill)"
                    />
                  </UTooltip>

                  <UTooltip text="Record Payment" v-if="bill.billStatus !== 'paid'">
                    <UButton
                      size="xs"
                      color="success"
                      variant="soft"
                      icon="i-heroicons-banknotes"
                      @click="openPaymentModal(bill)"
                    />
                  </UTooltip>

                  <UTooltip text="Mark as Unpaid" v-if="bill.billStatus === 'draft'">
                    <UButton
                      size="xs"
                      color="warning"
                      variant="soft"
                      icon="i-heroicons-arrow-right"
                      @click="updateBillStatus(bill.id, 'unpaid')"
                    />
                  </UTooltip>

                  <UTooltip text="Delete" v-if="bill.billStatus === 'draft'">
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      @click="deleteBill(bill.id)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="text-center py-16">
        <UIcon name="i-heroicons-document-text" class="w-16 h-16 text-gray-300 mx-auto" />
        <p class="text-gray-500 mt-4">No bills found</p>
        <UButton @click="showGenerateModal = true" color="primary" variant="soft" class="mt-4">
          Generate Your First Bill
        </UButton>
      </div>
    </UCard>

    <!-- Generate Bill Modal -->
    <UModal :open="showGenerateModal" @close="showGenerateModal = false">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Generate New Bill</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showGenerateModal = false"
              />
            </div>
          </template>

          <div class="space-y-4 p-1">
            <UFormField label="Room" required>
              <USelect
                v-model="generateForm.roomId"
                :items="availableRooms.map(r => ({ label: r.name, value: r.id }))"
                value-key="value"
                label-key="label"
                placeholder="Select room..."
              />
            </UFormField>

            <UFormField label="Tenant" required>
              <USelect
                v-model="generateForm.tenantId"
                :items="tenants.map(t => ({ label: t.name, value: t.id }))"
                value-key="value"
                label-key="label"
                placeholder="Select tenant..."
                :disabled="!!selectedRoom?.tenantId"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Period Start" required>
                <UInput type="date" v-model="generateForm.periodStart" />
              </UFormField>

              <UFormField label="Period End" required>
                <UInput type="date" v-model="generateForm.periodEnd" />
              </UFormField>
            </div>

            <UFormField label="Billing Options">
              <UCheckbox 
                v-model="generateForm.includeUtility" 
                label="Include Utility Charges"
                help="Uncheck to generate bill without utility charges"
              />
            </UFormField>

            <UFormField label="Notes">
              <UTextarea v-model="generateForm.notes" placeholder="Optional notes..." :rows="2" />
            </UFormField>

            <!-- Additional Charges -->
            <div class="border-t pt-4">
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-medium">Additional Charges</label>
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-plus"
                  @click="addAdditionalCharge"
                >
                  Add Charge
                </UButton>
              </div>

              <div v-for="(charge, index) in generateForm.additionalCharges" :key="index" class="space-y-2 mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <div class="flex-1 grid grid-cols-2 gap-2">
                    <UInput v-model="charge.itemName" placeholder="Item name" size="sm" />
                    <UInput v-model.number="charge.itemQty" type="number" placeholder="Qty" size="sm" />
                    <UInput v-model.number="charge.itemUnitPrice" type="number" placeholder="Unit price" size="sm" />
                    <UInput v-model.number="charge.itemDiscount" type="number" placeholder="Discount" size="sm" />
                  </div>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-heroicons-trash"
                    @click="removeAdditionalCharge(index)"
                  />
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showGenerateModal = false">
                Cancel
              </UButton>
              <UButton
                @click="generateBill"
                color="primary"
                :disabled="!generateForm.roomId || !generateForm.tenantId"
                :loading="loading"
                icon="i-heroicons-plus"
              >
                Generate Bill
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Generate Utility Bill Modal -->
    <UModal :open="showGenerateUtilityModal" @close="showGenerateUtilityModal = false" :ui="{ width: 'max-w-3xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Generate Utility Bill</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showGenerateUtilityModal = false"
              />
            </div>
          </template>

          <div class="space-y-4 p-1">
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Room" required>
                <USelect
                  v-model="generateUtilityForm.roomId"
                  :items="rooms"
                  value-key="id"
                  label-key="name"
                  placeholder="Select Room"
                  searchable
                />
              </UFormField>

              <UFormField label="Tenant" required>
                <USelect
                  v-model="generateUtilityForm.tenantId"
                  :items="tenants"
                  value-key="id"
                  label-key="name"
                  placeholder="Select Tenant"
                  searchable
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Period Start" required>
                <UInput type="date" v-model="generateUtilityForm.periodStart" />
              </UFormField>

              <UFormField label="Period End" required>
                <UInput type="date" v-model="generateUtilityForm.periodEnd" />
              </UFormField>
            </div>

            <!-- Utility Items -->
            <div class="border-t pt-4">
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-medium">Utility Items</label>
                <div class="flex gap-2">
                  <UButton
                    size="xs"
                    color="primary"
                    variant="ghost"
                    icon="i-heroicons-arrow-path"
                    @click="generateUtilityForm.utilityItems = []; autoGenerateUtilityItems()"
                    :loading="loading"
                    v-if="generateUtilityForm.roomId"
                  >
                    Auto Generate
                  </UButton>
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-plus"
                    @click="addUtilityItem"
                  >
                    Add Item
                  </UButton>
                </div>
              </div>

              <div class="space-y-3">
                <div v-if="generateUtilityForm.utilityItems.length === 0" class="text-center py-4 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                  No utility items added. Click "Add Item" to add charges.
                </div>
                
                <div
                  v-for="(item, index) in generateUtilityForm.utilityItems"
                  :key="index"
                  class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div class="flex gap-3 mb-2">
                    <UInput v-model="item.itemName" placeholder="Item name (e.g. Listrik)" size="sm" class="flex-1" />
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      @click="removeUtilityItem(index)"
                    />
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    <UInput v-model.number="item.itemQty" type="number" placeholder="Qty" size="sm" />
                    <UInput v-model.number="item.itemUnitPrice" type="number" placeholder="Unit price" size="sm" />
                    <div class="flex items-center justify-end font-mono text-sm">
                      {{ formatCurrency(item.itemQty * item.itemUnitPrice) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <UFormField label="Notes">
              <UTextarea v-model="generateUtilityForm.notes" placeholder="Optional notes..." :rows="2" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showGenerateUtilityModal = false">
                Cancel
              </UButton>
              <UButton
                @click="generateUtilityBill"
                color="primary"
                :loading="loading"
                icon="i-heroicons-bolt"
              >
                Generate Bill
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Payment Modal -->
    <UModal :open="showPaymentModal" @close="showPaymentModal = false">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Record Payment</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showPaymentModal = false"
              />
            </div>
          </template>

          <div class="space-y-4 p-1">
            <div class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg">
              <div class="text-sm text-gray-600 dark:text-gray-400">Bill Code</div>
              <div class="font-mono font-bold">{{ selectedBill?.billingCode }}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-2">Balance</div>
              <div class="text-2xl font-bold text-primary-600">
                {{ formatCurrency(selectedBill?.balance || selectedBill?.totalChargedAmount || 0) }}
              </div>
            </div>

            <UFormField label="Payment Method" required>
              <USelect
                v-model="paymentForm.paymentMethod"
                :items="[
                  { label: 'Cash', value: 'cash' },
                  { label: 'Online', value: 'online' }
                ]"
                value-key="value"
                label-key="label"
              />
            </UFormField>

            <UFormField label="Payment Amount" required>
              <UInput
                v-model.number="paymentForm.paymentAmount"
                type="number"
                :max="selectedBill?.balance || selectedBill?.totalChargedAmount"
              />
            </UFormField>

            <UFormField label="Payment Date" required>
              <UInput type="date" v-model="paymentForm.paymentDate" />
            </UFormField>

            <UFormField label="Notes">
              <UTextarea v-model="paymentForm.notes" placeholder="Optional notes..." :rows="2" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showPaymentModal = false">
                Cancel
              </UButton>
              <UButton
                @click="recordPayment"
                color="success"
                :loading="loading"
                icon="i-heroicons-check"
              >
                Record Payment
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Detail Modal -->
    <UModal :open="showDetailModal" @close="showDetailModal = false" :ui="{ width: 'max-w-3xl' }">
      <template #content>
        <UCard v-if="detailBill">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-lg">Bill Details</h3>
                <p class="text-sm text-gray-500 font-mono mt-1">{{ detailBill.billingCode }}</p>
              </div>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showDetailModal = false"
              />
            </div>
          </template>

          <div class="space-y-6 p-1">
            <!-- Bill Info -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-gray-500">Room</div>
                <div class="font-medium">{{ detailBill.room?.name }}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Tenant</div>
                <div class="font-medium">{{ detailBill.tenant?.name }}</div>
              </div>
              <div>
                <div class="flex items-center justify-between">
                  <div class="text-sm text-gray-500">Period</div>
                  <UButton
                    v-if="detailBill.billStatus !== 'paid'"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-pencil"
                    @click="openEditPeriodModal(detailBill)"
                  />
                </div>
                <div class="font-medium">
                  {{ formatDate(detailBill.periodStart) }} - {{ formatDate(detailBill.periodEnd) }}
                </div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Months Covered</div>
                <div class="font-medium">{{ detailBill.monthsCovered }}</div>
              </div>
            </div>

            <!-- Billing Details -->
            <div class="border-t pt-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold">Billing Details</h4>
                <UButton
                  v-if="detailBill.billStatus !== 'paid'"
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-plus"
                  @click="openAddDetailModal(detailBill)"
                >
                  Add Item
                </UButton>
              </div>
              <div class="space-y-2">
                <div
                  v-for="detail in detailBill.details"
                  :key="detail.id"
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div class="flex items-center gap-3 flex-1">
                    <UIcon :name="getItemTypeIcon(detail.itemType)" class="w-5 h-5 text-gray-400" />
                    <div class="flex-1">
                      <div class="font-medium">{{ detail.itemName }}</div>
                      <div class="text-xs text-gray-500">
                        {{ detail.itemQty }} × {{ formatCurrency(detail.itemUnitPrice) }}
                        <span v-if="detail.itemDiscount > 0" class="text-red-500">
                          - {{ formatCurrency(detail.itemDiscount) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="font-bold">{{ formatCurrency(detail.itemTotalAmount) }}</div>
                    <div v-if="detailBill.billStatus !== 'paid'" class="flex gap-1">
                      <UTooltip text="Edit Item">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          icon="i-heroicons-pencil"
                          @click="openEditDetailModal(detail)"
                        />
                      </UTooltip>
                      <UTooltip text="Delete Item">
                        <UButton
                          size="xs"
                          color="error"
                          variant="ghost"
                          icon="i-heroicons-trash"
                          @click="deleteBillingDetail(detail.id)"
                        />
                      </UTooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Payments -->
            <div v-if="detailBill.payments && detailBill.payments.length > 0" class="border-t pt-4">
              <h4 class="font-semibold mb-3">Payment History</h4>
              <div class="space-y-2">
                <div
                  v-for="payment in detailBill.payments"
                  :key="payment.id"
                  class="flex items-center justify-between p-3 bg-success-50 dark:bg-success-900/20 rounded-lg"
                >
                  <div>
                    <div class="font-medium">{{ payment.paymentMethod.toUpperCase() }}</div>
                    <div class="text-xs text-gray-500">{{ formatDate(payment.paymentDate) }}</div>
                  </div>
                  <div class="font-bold text-success-600">
                    {{ formatCurrency(payment.paymentAmount) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div class="border-t pt-4 space-y-2">
              <div class="flex justify-between text-lg">
                <span class="font-medium">Total Charged:</span>
                <span class="font-bold">{{ formatCurrency(detailBill.totalChargedAmount) }}</span>
              </div>
              <div v-if="detailBill.totalPaid" class="flex justify-between text-success-600">
                <span class="font-medium">Total Paid:</span>
                <span class="font-bold">{{ formatCurrency(detailBill.totalPaid) }}</span>
              </div>
              <div v-if="detailBill.balance" class="flex justify-between text-xl text-red-600">
                <span class="font-medium">Balance:</span>
                <span class="font-bold">{{ formatCurrency(detailBill.balance) }}</span>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showDetailModal = false">
                Close
              </UButton>
              <UButton
                v-if="detailBill.billStatus !== 'paid'"
                @click="openPaymentModal(detailBill); showDetailModal = false"
                color="success"
                icon="i-heroicons-banknotes"
              >
                Record Payment
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Add Detail Modal -->
    <UModal :open="showAddDetailModal" @close="showAddDetailModal = false">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Add Billing Item</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showAddDetailModal = false"
              />
            </div>
          </template>

          <div class="space-y-4 p-1">
            <UFormField label="Item Type" required>
              <USelect
                v-model="addDetailForm.itemType"
                :items="[
                  { label: 'Rent', value: 'rent' },
                  { label: 'Utility', value: 'utility' },
                  { label: 'Others', value: 'others' }
                ]"
                value-key="value"
                label-key="label"
              />
            </UFormField>

            <UFormField label="Item Name" required>
              <UInput v-model="addDetailForm.itemName" placeholder="e.g., Parkir, Kebersihan" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Quantity" required>
                <UInput v-model.number="addDetailForm.itemQty" type="number" min="1" />
              </UFormField>

              <UFormField label="Unit Price" required>
                <UInput v-model.number="addDetailForm.itemUnitPrice" type="number" min="0" />
              </UFormField>
            </div>

            <UFormField label="Discount">
              <UInput v-model.number="addDetailForm.itemDiscount" type="number" min="0" />
            </UFormField>

            <UFormField label="Notes">
              <UTextarea v-model="addDetailForm.notes" placeholder="Optional notes..." :rows="2" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showAddDetailModal = false">
                Cancel
              </UButton>
              <UButton
                @click="addBillingDetail"
                color="primary"
                :loading="loading"
                icon="i-heroicons-plus"
              >
                Add Item
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Edit Detail Modal -->
    <UModal :open="showEditDetailModal" @close="showEditDetailModal = false">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Edit Billing Item</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showEditDetailModal = false"
              />
            </div>
          </template>


          <div class="space-y-4 p-1">
            <!-- Warning for Rent Items -->
            <div v-if="editingDetail?.itemType === 'rent'" class="bg-info-50 dark:bg-info-900/20 p-4 rounded-lg">
              <div class="flex gap-2">
                <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-info-600" />
                <div class="text-sm text-info-700 dark:text-info-400">
                  <strong>Rent Item:</strong> Quantity and Unit Price are calculated automatically based on the billing period. Use "Edit Period" to change rent charges.
                </div>
              </div>
            </div>

            <UFormField label="Item Name" required>
              <UInput v-model="editDetailForm.itemName" placeholder="Item name" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField 
                label="Quantity" 
                required
                :help="editingDetail?.itemType === 'rent' ? 'Auto-calculated from period' : ''"
              >
                <UInput 
                  v-model.number="editDetailForm.itemQty" 
                  type="number" 
                  min="1"
                  :disabled="editingDetail?.itemType === 'rent'"
                />
              </UFormField>

              <UFormField 
                label="Unit Price" 
                required
                :help="editingDetail?.itemType === 'rent' ? 'Auto-calculated from room price' : ''"
              >
                <UInput 
                  v-model.number="editDetailForm.itemUnitPrice" 
                  type="number" 
                  min="0"
                  :disabled="editingDetail?.itemType === 'rent'"
                />
              </UFormField>
            </div>

            <UFormField label="Discount">
              <UInput v-model.number="editDetailForm.itemDiscount" type="number" min="0" />
            </UFormField>

            <UFormField label="Notes">
              <UTextarea v-model="editDetailForm.notes" placeholder="Optional notes..." :rows="2" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showEditDetailModal = false">
                Cancel
              </UButton>
              <UButton
                @click="updateBillingDetail"
                color="primary"
                :loading="loading"
                icon="i-heroicons-check"
              >
                Update Item
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Edit Period Modal -->
    <UModal :open="showEditPeriodModal" @close="showEditPeriodModal = false">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-lg">Edit Bill Period</h3>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-x-mark"
                @click="showEditPeriodModal = false"
              />
            </div>
          </template>

          <div class="space-y-4 p-1">
            <div class="bg-warning-50 dark:bg-warning-900/20 p-4 rounded-lg mb-4">
              <div class="flex gap-2">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-warning-600" />
                <div class="text-sm text-warning-700 dark:text-warning-400">
                  <strong>Note:</strong> Changing the period will automatically recalculate the rent charges based on the new months covered.
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Period Start" required>
                <UInput type="date" v-model="editPeriodForm.periodStart" />
              </UFormField>

              <UFormField label="Period End" required>
                <UInput type="date" v-model="editPeriodForm.periodEnd" />
              </UFormField>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showEditPeriodModal = false">
                Cancel
              </UButton>
              <UButton
                @click="updateBillPeriod"
                color="primary"
                :loading="loading"
                icon="i-heroicons-check"
              >
                Update Period
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Confirm Dialog -->
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
