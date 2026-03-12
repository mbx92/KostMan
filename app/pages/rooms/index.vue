<script setup lang="ts">
import { useKosStore, type Room } from '~/stores/kos'
import ConfirmDialog from "~/components/ConfirmDialog.vue";

const store = useKosStore()
const { rooms, properties, roomsLoading, roomsError, roomsMeta, propertiesLoading } = storeToRefs(store)
const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

// Filter state
const route = useRoute()
const selectedPropertyId = ref<string>((route.query.propertyId as string) || '__all__')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 20

// Room Modal State
const isRoomModalOpen = ref(false)
const selectedRoom = ref<Room | undefined>(undefined)
const modalPropertyId = ref<string>('')

// Fetch data on mount
onMounted(async () => {
  await store.fetchProperties()
  await loadRooms()
})

// Load rooms with current filter
async function loadRooms() {
  const params: { propertyId?: string; search?: string; page?: number; pageSize?: number } = { 
    page: currentPage.value,
    pageSize: pageSize 
  }
  if (selectedPropertyId.value !== '__all__') {
    params.propertyId = selectedPropertyId.value
  }
  if (searchQuery.value.trim()) {
    params.search = searchQuery.value.trim()
  }
  await store.fetchRooms(params)
}

// Watch filter changes with debounce for search
let searchTimeout: NodeJS.Timeout
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadRooms()
  }, 300)
})

watch(selectedPropertyId, () => {
  currentPage.value = 1
  loadRooms()
})

watch(currentPage, () => {
  loadRooms()
})

// Property options for filter
const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: '__all__' },
  ...properties.value.map(p => ({ label: p.name, value: p.id }))
])

// Check if initial loading (both properties and rooms)
const isInitialLoading = computed(() => propertiesLoading.value || (roomsLoading.value && enrichedRooms.value.length === 0))

// Computed to enrich room data with property name
const enrichedRooms = computed(() => {
    return rooms.value.map(room => {
        const property = room.property || properties.value.find(p => p.id === room.propertyId)
        return {
            ...room,
            price: Number(room.price),
            propertyName: property ? property.name : 'Unknown Property',
            tenantName: room.tenantName || ''
        }
    })
})

const getStatusColor = (status: string) => {
    switch(status) {
        case 'available': return 'success'
        case 'occupied': return 'primary'
        case 'maintenance': return 'warning'
        default: return 'neutral'
    }
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

// Room CRUD
const openAddRoomModal = () => {
    selectedRoom.value = undefined
    // Use currently filtered property or first property
    modalPropertyId.value = selectedPropertyId.value !== '__all__' 
        ? selectedPropertyId.value 
        : (properties.value[0]?.id || '')
    isRoomModalOpen.value = true
}

const openEditRoomModal = (room: Room) => {
    selectedRoom.value = room
    modalPropertyId.value = room.propertyId
    isRoomModalOpen.value = true
}

const deleteRoom = async (room: Room) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Kamar?',
    message: `Apakah Anda yakin ingin menghapus "${room.name}"? Ini juga akan menghapus riwayat billing-nya.`,
    confirmText: 'Ya, Hapus',
    confirmColor: 'error'
  })
  
  if (!confirmed) return
  
  try {
    await store.deleteRoom(room.id)
    toast.add({ title: 'Kamar Dihapus', color: 'success' })
  } catch (err: any) {
    toast.add({ 
        title: 'Error', 
        description: err?.data?.message || err?.message || 'Gagal menghapus kamar',
        color: 'error' 
    })
  }
}

const onModalClose = () => {
  loadRooms()
}

// Update Room Price Modal State
const isUpdateRoomPriceModalOpen = ref(false)
const priceChangeValue = ref<number | null>(null)
const selectedModalPropertyId = ref<string>('__all__')
const selectedModalRoomIds = ref<string[]>([])

const modalRoomsLoading = ref(false)
const modalRoomsError = ref<string | null>(null)
const modalRoomsData = ref<Room[]>([])

const isBulkUpdatingRoomPrices = ref(false)
const bulkUpdateError = ref<string | null>(null)
const bulkUpdateProgress = ref({
  current: 0,
  total: 0,
  percentage: 0
})

const loadModalRooms = async () => {
  modalRoomsLoading.value = true
  modalRoomsError.value = null
  try {
    const query = new URLSearchParams()
    query.append('all', 'true')
    if (selectedModalPropertyId.value !== '__all__') {
      query.append('propertyId', selectedModalPropertyId.value)
    }
    const response = await $fetch<{ data: Room[] }>(`/api/rooms?${query.toString()}`)
    modalRoomsData.value = (response.data || []).map(r => ({
      ...r,
      price: Number((r as any).price)
    }))
  } catch (err: any) {
    modalRoomsError.value = err?.data?.message || err?.message || 'Gagal memuat daftar kamar'
  } finally {
    modalRoomsLoading.value = false
  }
}

const openUpdateRoomPriceModal = () => {
  selectedModalPropertyId.value = selectedPropertyId.value !== '__all__'
    ? selectedPropertyId.value
    : '__all__'
  selectedModalRoomIds.value = []
  priceChangeValue.value = null
  bulkUpdateError.value = null
  bulkUpdateProgress.value = { current: 0, total: 0, percentage: 0 }
  isUpdateRoomPriceModalOpen.value = true
  loadModalRooms()
}

const modalRooms = computed(() => {
  return modalRoomsData.value.map(room => {
    const property = (room as any).property || properties.value.find(p => p.id === room.propertyId)
    return {
      ...room,
      price: Number((room as any).price),
      propertyName: property ? property.name : 'Unknown Property',
      tenantName: (room as any).tenantName || ''
    }
  })
})

const selectedModalRooms = computed(() => {
  const selected = new Set(selectedModalRoomIds.value)
  return modalRooms.value.filter(r => selected.has(r.id))
})

const canApplyBulkUpdate = computed(() => {
  return (
    !isBulkUpdatingRoomPrices.value &&
    priceChangeValue.value !== null &&
    Number.isFinite(Number(priceChangeValue.value)) &&
    Number(priceChangeValue.value) > 0 &&
    selectedModalRoomIds.value.length > 0
  )
})

const areAllModalRoomsSelected = computed(() => {
  return modalRooms.value.length > 0 && selectedModalRoomIds.value.length === modalRooms.value.length
})

const toggleAllModalRooms = () => {
  if (areAllModalRoomsSelected.value) {
    selectedModalRoomIds.value = []
  } else {
    selectedModalRoomIds.value = modalRooms.value.map(r => r.id)
  }
}

const applyBulkUpdateRoomPrices = async () => {
  if (!canApplyBulkUpdate.value) return

  const newPrice = Number(priceChangeValue.value)
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    toast.add({
      title: 'Harga tidak valid',
      description: 'Masukkan nominal harga baru yang valid.',
      color: 'error'
    })
    return
  }

  isBulkUpdatingRoomPrices.value = true
  bulkUpdateError.value = null

  const roomsToUpdate = [...selectedModalRooms.value]
  bulkUpdateProgress.value = {
    current: 0,
    total: roomsToUpdate.length,
    percentage: 0
  }

  try {
    for (const room of roomsToUpdate) {
      await $fetch(`/api/rooms/${room.id}`, {
        method: 'PUT',
        body: {
          price: newPrice
        }
      })

      const idx = rooms.value.findIndex(r => r.id === room.id)
      if (idx !== -1) {
        rooms.value[idx] = { ...rooms.value[idx], price: newPrice }
      }

      const modalIdx = modalRoomsData.value.findIndex(r => r.id === room.id)
      if (modalIdx !== -1) {
        modalRoomsData.value[modalIdx] = { ...modalRoomsData.value[modalIdx], price: newPrice }
      }

      bulkUpdateProgress.value.current += 1
      bulkUpdateProgress.value.percentage = Math.round(
        (bulkUpdateProgress.value.current / bulkUpdateProgress.value.total) * 100
      )
    }

    toast.add({
      title: 'Harga Berhasil Diperbarui',
      description: `Berhasil mengubah harga untuk ${bulkUpdateProgress.value.total} kamar.`,
      color: 'success'
    })

    await loadRooms()
    selectedModalRoomIds.value = []
    await loadModalRooms()

    setTimeout(() => {
      bulkUpdateProgress.value = { current: 0, total: 0, percentage: 0 }
      bulkUpdateError.value = null
    }, 400)
  } catch (err: any) {
    const message = err?.data?.message || err?.message || 'Gagal memperbarui harga kamar'
    bulkUpdateError.value = message
    toast.add({
      title: 'Gagal Memperbarui Harga',
      description: message,
      color: 'error'
    })
  } finally {
    isBulkUpdatingRoomPrices.value = false
  }
}

watch(selectedModalPropertyId, () => {
  selectedModalRoomIds.value = []
  if (isUpdateRoomPriceModalOpen.value && !isBulkUpdatingRoomPrices.value) {
    loadModalRooms()
  }
})

watch(isUpdateRoomPriceModalOpen, (open) => {
  if (!process.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})

onBeforeUnmount(() => {
  if (!process.client) return
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="p-6 space-y-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-home-modern" class="w-8 h-8 text-primary-500" />
            Kamar
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola hunian dan detail kamar.</p>
      </div>
      
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-pencil" size="lg" @click="openUpdateRoomPriceModal" :disabled="properties.length === 0">
            Ubah Harga
        </UButton>
        <UButton icon="i-heroicons-plus" size="lg" @click="openAddRoomModal" :disabled="properties.length === 0">
            Tambah Kamar
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div class="flex flex-wrap gap-4 items-center">
      <!-- Search -->
      <UInput 
        v-model="searchQuery" 
        placeholder="Cari nama kamar..." 
        icon="i-heroicons-magnifying-glass"
        class="w-full md:w-64"
        :loading="roomsLoading"
      />
      <!-- Property Filter -->
      <USelect 
        v-model="selectedPropertyId" 
        :items="propertyOptions" 
        value-key="value" 
        label-key="label"
        class="w-full md:w-48"
        :disabled="roomsLoading"
      />
      <span v-if="roomsMeta.total > 0" class="text-sm text-gray-500 ml-auto flex items-center gap-2">
        <UIcon v-if="roomsLoading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
        {{ roomsMeta.total }} kamar
      </span>
      </div>
    </div>

    <!-- Results Info -->
    <div v-if="roomsMeta.total > 0 && roomsMeta.totalPages > 1" class="flex items-center justify-between text-sm text-gray-500">
      <span>Halaman {{ roomsMeta.page }} dari {{ roomsMeta.totalPages }}</span>
      <span>Menampilkan {{ enrichedRooms.length }} data</span>
    </div>

    <!-- Error State -->
    <div v-if="roomsError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-exclamation-circle" class="w-6 h-6 text-red-500" />
        <div>
          <h3 class="font-medium text-red-800 dark:text-red-200">Gagal memuat kamar</h3>
          <p class="text-sm text-red-600 dark:text-red-400">{{ roomsError }}</p>
        </div>
        <UButton size="sm" color="error" variant="soft" class="ml-auto" @click="loadRooms()">
          Coba Lagi
        </UButton>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isInitialLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div 
        v-for="i in 4" 
        :key="i"
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
      >
        <div class="h-1 w-full bg-gray-200 dark:bg-gray-700"></div>
        <div class="p-5 space-y-4">
          <USkeleton class="h-5 w-20" />
          <USkeleton class="h-3 w-32" />
          <USkeleton class="h-8 w-28" />
          <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
            <USkeleton class="h-4 w-full" />
          </div>
        </div>
        <div class="p-2 bg-gray-50 dark:bg-gray-800/50 flex gap-2">
          <USkeleton class="h-9 flex-1" />
          <USkeleton class="h-9 w-9" />
          <USkeleton class="h-9 w-9" />
        </div>
      </div>
    </div>

    <!-- No Properties Warning -->
    <div v-else-if="!propertiesLoading && properties.length === 0" class="text-center py-12 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12 text-orange-500 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">Properti Tidak Ditemukan</h3>
      <p class="text-gray-500 mt-1 mb-4">Anda perlu membuat properti terlebih dahulu sebelum menambah kamar.</p>
      <UButton to="/properties" icon="i-heroicons-building-office-2">Ke Properti</UButton>
    </div>

    <!-- Room Grid -->
    <div v-else-if="enrichedRooms.length > 0" class="relative">
        <!-- Loading Overlay for pagination -->
        <div v-if="roomsLoading" class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
          <div class="flex flex-col items-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
            <span class="text-sm text-gray-600 dark:text-gray-400">Memuat data...</span>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-200" :class="{ 'opacity-50': roomsLoading }">
        <div 
            v-for="room in enrichedRooms" 
            :key="room.id" 
            class="group relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-primary-500/50 transition-all duration-200 overflow-hidden flex flex-col"
        >
            <!-- Status Line -->
            <div 
                class="h-1 w-full absolute top-0 left-0"
                :class="{
                    'bg-green-500': room.status === 'available',
                    'bg-blue-500': room.status === 'occupied',
                    'bg-orange-500': room.status === 'maintenance'
                }"
            ></div>

            <div class="p-5 flex-1 flex flex-col gap-4">
                <!-- Header: Name & Badge -->
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {{ room.name }}
                        </h3>
                        <div class="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <UIcon name="i-heroicons-building-office-2" class="w-3 h-3" />
                            {{ room.propertyName }}
                        </div>
                    </div>
                    <UBadge :color="getStatusColor(room.status)" variant="subtle" class="capitalize">
                        {{ room.status === 'available' ? 'Tersedia' : room.status === 'occupied' ? 'Terisi' : 'Perbaikan' }}
                    </UBadge>
                </div>

                <!-- Price -->
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                    {{ formatCurrency(room.price) }}
                    <span class="text-xs font-normal text-gray-500">/bulan</span>
                </div>

                <!-- Tenant Info -->
                <div class="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div v-if="room.status === 'occupied'" class="flex items-center gap-3">
                        <UAvatar :alt="room.tenantName" size="sm" class="bg-primary-100 text-primary-600 ring-2 ring-white dark:ring-gray-900" />
                        <div>
                            <div class="text-xs text-gray-500">Ditempati oleh</div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                                {{ room.tenantName }}
                            </div>
                        </div>
                    </div>
                    <div v-else-if="room.status === 'available'" class="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
                        <span class="text-sm font-medium">Siap untuk penghuni</span>
                    </div>
                    <div v-else class="flex items-center gap-2 text-orange-500">
                        <UIcon name="i-heroicons-wrench-screwdriver" class="w-5 h-5" />
                        <span class="text-sm font-medium">Dalam perbaikan</span>
                    </div>
                </div>
            </div>

            <!-- Footer Actions -->
            <div class="p-2 bg-gray-50 dark:bg-gray-800/50 flex gap-2">
                <UButton :to="`/rooms/${room.id}`" class="flex-1" color="neutral" variant="outline" icon="i-heroicons-adjustments-horizontal">
                    Kelola
                </UButton>
                <UButton icon="i-heroicons-pencil-square" color="neutral" variant="ghost" @click.stop="openEditRoomModal(room)" />
                <UButton icon="i-heroicons-trash" color="error" variant="ghost" @click.stop="deleteRoom(room)" />
            </div>
        </div>
        </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
        <UIcon name="i-heroicons-home" class="w-16 h-16 text-gray-300 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Kamar tidak ditemukan</h3>
        <p class="text-gray-500 mt-2 mb-4">
          {{ selectedPropertyId === '__all__' ? 'Mulai dengan menambah kamar pertama Anda.' : 'Tidak ada kamar untuk filter properti ini.' }}
        </p>
        <UButton icon="i-heroicons-plus" @click="openAddRoomModal">Tambah Kamar</UButton>
    </div>

    <!-- Room Modal -->
    <RoomModal v-model="isRoomModalOpen" :property-id="modalPropertyId" :room="selectedRoom" @update:modelValue="onModalClose" />
    
    <ConfirmDialog ref="confirmDialog" />

    <!-- Update Room Price Modal -->
    <UModal
      v-model:open="isUpdateRoomPriceModalOpen"
      title="Ubah Harga Kamar"
      description="Perbarui harga kamar secara global berdasarkan properti yang dipilih"
      :preventClose="isBulkUpdatingRoomPrices"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #content>
        <div class="p-6 space-y-6">
          <!-- Top section: Form + Property Checklist -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Price Change Form -->
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Harga Baru</h3>
              <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 text-sm">Rp</span>
                <UInput
                  v-model="priceChangeValue"
                  type="number"
                  placeholder="cth: 1500000"
                  :disabled="isBulkUpdatingRoomPrices"
                  class="pl-8 w-full"
                />
              </div>
              <p class="text-xs text-gray-400">
                Masukkan harga baru yang akan diterapkan ke kamar yang dipilih.
              </p>
            </div>

            <!-- Property Checklist -->
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Terapkan ke Properti</h3>
              <select 
                v-model="selectedModalPropertyId"
                :disabled="isBulkUpdatingRoomPrices"
                class="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="__all__">Semua Properti</option>
                <option v-for="property in properties" :key="property.id" :value="property.id">
                  {{ property.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Progress -->
          <div v-if="isBulkUpdatingRoomPrices || bulkUpdateProgress.total > 0" class="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div class="flex items-center justify-between text-sm mb-2">
              <span class="text-gray-600 dark:text-gray-400">
                {{ bulkUpdateProgress.current }} / {{ bulkUpdateProgress.total }}
              </span>
              <span class="font-medium text-gray-900 dark:text-white">{{ bulkUpdateProgress.percentage }}%</span>
            </div>
            <UProgress :value="bulkUpdateProgress.percentage" size="lg" />
            <p v-if="bulkUpdateError" class="text-xs text-red-500 mt-2">{{ bulkUpdateError }}</p>
          </div>

          <!-- Rooms Table -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Daftar Kamar Terdampak</h3>
              <UBadge color="primary" variant="subtle" size="xs">{{ modalRooms.length }} kamar</UBadge>
              <span v-if="modalRoomsLoading" class="text-xs text-gray-400 flex items-center gap-1">
                <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 animate-spin" />
                Memuat...
              </span>
            </div>
            <div class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div class="overflow-y-auto overscroll-contain max-h-60">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                    <tr>
                      <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">
                        <button
                          class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          type="button"
                          :disabled="isBulkUpdatingRoomPrices || modalRoomsLoading"
                          @click="toggleAllModalRooms"
                        >
                          <input
                            type="checkbox"
                            class="accent-primary-500"
                            :checked="areAllModalRoomsSelected"
                            @change.prevent
                          />
                        </button>
                      </th>
                      <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">No</th>
                      <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nama Kamar</th>
                      <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Properti</th>
                      <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Harga Saat Ini</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    <tr v-if="modalRoomsError">
                      <td colspan="5" class="px-4 py-6">
                        <div class="flex items-center gap-2 text-red-500 text-sm">
                          <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5" />
                          <span>{{ modalRoomsError }}</span>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="modalRooms.length === 0">
                      <td colspan="5" class="px-4 py-10 text-center">
                        <UIcon name="i-heroicons-inbox" class="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p class="text-sm text-gray-400">Tidak ada kamar untuk properti yang dipilih</p>
                      </td>
                    </tr>
                    <tr
                      v-for="(room, idx) in modalRooms"
                      :key="room.id"
                      class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td class="px-4 py-3">
                        <input
                          type="checkbox"
                          :value="room.id"
                          v-model="selectedModalRoomIds"
                          :disabled="isBulkUpdatingRoomPrices || modalRoomsLoading"
                          class="accent-primary-500"
                        />
                      </td>
                      <td class="px-4 py-3 text-xs text-gray-400">{{ idx + 1 }}</td>
                      <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ room.name }}</td>
                      <td class="px-4 py-3">
                        <UBadge color="neutral" variant="subtle" size="xs">{{ room.propertyName }}</UBadge>
                      </td>
                      <td class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                        {{ formatCurrency(room.price) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton color="neutral" variant="outline" :disabled="isBulkUpdatingRoomPrices" @click="isUpdateRoomPriceModalOpen = false">
              Batal
            </UButton>
            <UButton
              icon="i-heroicons-check"
              :disabled="!canApplyBulkUpdate"
              :loading="isBulkUpdatingRoomPrices"
              @click="applyBulkUpdateRoomPrices"
            >
              Terapkan Perubahan
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Pagination -->
    <div v-if="roomsMeta.totalPages > 1" class="flex justify-center pt-4">
      <UPagination 
        :page="currentPage" 
        :total="roomsMeta.total" 
        :items-per-page="pageSize"
        @update:page="(p) => currentPage = p"
      />
    </div>
  </div>
</template>

