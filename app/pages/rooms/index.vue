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
      
      <UButton icon="i-heroicons-plus" size="lg" @click="openAddRoomModal" :disabled="properties.length === 0">
          Tambah Kamar
      </UButton>
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
                        {{ room.status }}
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

