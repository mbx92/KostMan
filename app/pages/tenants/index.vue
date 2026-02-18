<script setup lang="ts">
import { useKosStore, type Tenant } from '~/stores/kos'

const store = useKosStore()
const { tenants, tenantsLoading, tenantsMeta, properties } = storeToRefs(store)
const toast = useToast()

const isModalOpen = ref(false)
const selectedTenant = ref(undefined)

// Pagination and Filter state
const currentPage = ref(1)

const searchQuery = ref('')
const statusFilter = ref<string>('__all__')

// Reset PIN Modal
const isResetPinModalOpen = ref(false)
const resetPinTenant = ref<Tenant | null>(null)
const resetPinLoading = ref(false)

// Delete Modal
const isDeleteModalOpen = ref(false)
const deleteTenant = ref<Tenant | null>(null)
const deleteLoading = ref(false)

// Load tenants with current filters
async function loadTenants() {
  const params: { status?: 'active' | 'inactive'; search?: string; page?: number; pageSize?: number; all?: boolean } = {
    page: currentPage.value,
    all: true
  }
  if (statusFilter.value !== '__all__') {
    params.status = statusFilter.value as 'active' | 'inactive'
  }
  if (searchQuery.value.trim()) {
    params.search = searchQuery.value.trim()
  }
  await store.fetchTenants(params)
}

// Fetch data on mount
onMounted(async () => {
  await loadTenants()
  await store.fetchProperties()
})

// Watch filter changes with debounce
let searchTimeout: NodeJS.Timeout
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadTenants()
  }, 300)
})

watch(statusFilter, () => {
  currentPage.value = 1
  loadTenants()
})

watch(currentPage, () => {
  loadTenants()
})



// Get assigned room from tenant data (already included in API response)
const getAssignedRoom = (tenant: any) => {
  return tenant.assignedRoom || null
}

// Group tenants by property
interface PropertyGroup {
  propertyId: string
  propertyName: string
  tenants: any[]
}

const collapsedGroups = ref<Set<string>>(new Set())

const toggleGroup = (propertyId: string) => {
  const newSet = new Set(collapsedGroups.value)
  if (newSet.has(propertyId)) {
    newSet.delete(propertyId)
  } else {
    newSet.add(propertyId)
  }
  collapsedGroups.value = newSet
}

const isGroupCollapsed = (propertyId: string) => {
  return collapsedGroups.value.has(propertyId)
}

const groupedTenants = computed<PropertyGroup[]>(() => {
  const groups = new Map<string, PropertyGroup>()
  const NO_PROPERTY_KEY = '__no_property__'

  for (const tenant of tenants.value) {
    const room = getAssignedRoom(tenant)
    const propertyId = room?.propertyId || NO_PROPERTY_KEY
    const propertyName = room?.propertyName || 'Belum Ada Kamar'

    if (!groups.has(propertyId)) {
      groups.set(propertyId, {
        propertyId,
        propertyName,
        tenants: []
      })
    }
    groups.get(propertyId)!.tenants.push(tenant)
  }

  // Sort: properties with names first, then "Belum Ada Kamar" last
  const result = Array.from(groups.values())
  result.sort((a, b) => {
    if (a.propertyId === NO_PROPERTY_KEY) return 1
    if (b.propertyId === NO_PROPERTY_KEY) return -1
    return a.propertyName.localeCompare(b.propertyName)
  })

  return result
})

// Status filter options
const statusOptions = [
  { label: 'Semua Status', value: '__all__' },
  { label: 'Aktif', value: 'active' },
  { label: 'Tidak Aktif', value: 'inactive' }
]

// Page size options


const openAddModal = () => {
  selectedTenant.value = undefined
  isModalOpen.value = true
}

const openEditModal = (tenant: any) => {
  selectedTenant.value = tenant
  isModalOpen.value = true
}

const openDeleteModal = (tenant: Tenant) => {
  deleteTenant.value = tenant
  isDeleteModalOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteTenant.value) return
  
  deleteLoading.value = true
  try {
    await store.deleteTenant(deleteTenant.value.id)
    toast.add({ title: 'Penghuni Dihapus', color: 'success' })
    isDeleteModalOpen.value = false
    loadTenants()
  } catch (err: any) {
    toast.add({ 
      title: 'Error', 
      description: err?.data?.message || 'Gagal menghapus penghuni',
      color: 'error' 
    })
  } finally {
    deleteLoading.value = false
  }
}

const openResetPinModal = (tenant: Tenant) => {
  resetPinTenant.value = tenant
  isResetPinModalOpen.value = true
}

const confirmResetPin = async () => {
  if (!resetPinTenant.value) return
  
  resetPinLoading.value = true
  try {
    const response = await $fetch(`/api/tenants/${resetPinTenant.value.id}/reset-pin`, {
      method: 'POST'
    })
    toast.add({ 
      title: 'PIN Berhasil Direset', 
      description: `PIN baru: ${(response as any).defaultPin}`,
      color: 'success' 
    })
    isResetPinModalOpen.value = false
  } catch (err: any) {
    toast.add({ 
      title: 'Error', 
      description: err?.data?.message || 'Gagal reset PIN',
      color: 'error' 
    })
  } finally {
    resetPinLoading.value = false
  }
}

// Handle modal close
const onModalClose = () => {
  loadTenants()
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-user-group" class="w-8 h-8 text-primary-500" />
           Penghuni
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola direktori penghuni Anda.</p>
      </div>
      <UButton icon="i-heroicons-plus" size="lg" @click="openAddModal">Tambah Penghuni</UButton>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div class="flex flex-wrap gap-4 items-center">
      <!-- Search -->
      <UInput 
        v-model="searchQuery" 
        placeholder="Cari nama, kontak, atau No. KTP..." 
        icon="i-heroicons-magnifying-glass"
        class="w-full md:w-64"
      />
      <!-- Status Filter -->
      <USelect 
        v-model="statusFilter" 
        :items="statusOptions" 
        value-key="value" 
        label-key="label"
        class="w-full md:w-40"
      />
      <span v-if="tenantsMeta.total > 0" class="text-sm text-gray-500 ml-auto">
        Total {{ tenantsMeta.total }} penghuni
      </span>
      </div>
    </div>



    <!-- Loading State -->
    <div v-if="tenantsLoading && tenants.length === 0" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <USkeleton class="h-6 w-48 mb-4" />
        <div v-for="j in 3" :key="j" class="flex items-center gap-3 py-3 border-t border-gray-100 dark:border-gray-800">
          <USkeleton class="h-8 w-8 rounded-full" />
          <div class="space-y-1 flex-1">
            <USkeleton class="h-4 w-32" />
            <USkeleton class="h-3 w-24" />
          </div>
        </div>
      </div>
    </div>

    <!-- Tenants List Grouped by Property -->
    <div v-else-if="tenants.length > 0" class="relative">
      <!-- Loading Overlay for pagination -->
      <div v-if="tenantsLoading" class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
          <span class="text-sm text-gray-600 dark:text-gray-400">Memuat data...</span>
        </div>
      </div>
      
      <div class="space-y-4 transition-opacity duration-200" :class="{ 'opacity-50': tenantsLoading }">
        <div 
          v-for="group in groupedTenants" 
          :key="group.propertyId"
          class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          <!-- Property Group Header -->
          <button 
            class="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
            @click="toggleGroup(group.propertyId)"
          >
            <div class="flex items-center gap-3">
              <div class="p-1.5 rounded-lg" :class="group.propertyId === '__no_property__' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-primary-50 dark:bg-primary-900/30'">
                <UIcon 
                  :name="group.propertyId === '__no_property__' ? 'i-heroicons-question-mark-circle' : 'i-heroicons-building-office-2'" 
                  class="w-5 h-5" 
                  :class="group.propertyId === '__no_property__' ? 'text-gray-400' : 'text-primary-500'"
                />
              </div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ group.propertyName }}</h2>
              <UBadge color="neutral" variant="subtle" size="xs">{{ group.tenants.length }} penghuni</UBadge>
            </div>
            <UIcon 
              name="i-heroicons-chevron-down" 
              class="w-5 h-5 text-gray-400 transition-transform duration-200" 
              :class="{ '-rotate-90': isGroupCollapsed(group.propertyId) }"
            />
          </button>

          <!-- Tenant List -->
          <div v-show="!isGroupCollapsed(group.propertyId)">
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div 
                v-for="tenant in group.tenants" 
                :key="tenant.id" 
                class="relative flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group/row"
              >
                <!-- Avatar & Main Info -->
                <div class="flex items-start gap-4 flex-1 min-w-0 w-full sm:w-auto">
                  <UAvatar :alt="tenant.name" size="md" />

                  <div class="space-y-1 min-w-0 flex-1">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-bold text-gray-900 dark:text-white truncate text-base min-w-0">{{ tenant.name }}</span>
                      <UBadge :color="tenant.status === 'active' ? 'success' : 'neutral'" variant="subtle" size="xs" class="flex-shrink-0">
                        {{ tenant.status === 'active' ? 'Aktif' : 'Tidak Aktif' }}
                      </UBadge>
                    </div>
                    
                    <div class="space-y-1">
                        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <UIcon name="i-heroicons-phone" class="w-4 h-4 flex-shrink-0" />
                            <span class="truncate">{{ tenant.contact }}</span>
                        </div>
                        <div v-if="tenant.idCardNumber" class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500 font-mono text-xs">
                           <UIcon name="i-heroicons-identification" class="w-4 h-4 flex-shrink-0" />
                           <span class="truncate">{{ tenant.idCardNumber }}</span>
                        </div>
                    </div>

                    <!-- Mobile Room Info (Visible only on mobile) -->
                    <div class="sm:hidden flex items-center gap-2 text-sm mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <UIcon name="i-heroicons-home" class="w-4 h-4 flex-shrink-0" :class="getAssignedRoom(tenant) ? 'text-primary-500' : 'text-gray-300'" />
                      <span v-if="getAssignedRoom(tenant)" class="text-primary-600 dark:text-primary-400 font-medium">
                        {{ getAssignedRoom(tenant).name }}
                      </span>
                      <span v-else class="text-gray-400 italic text-xs">Belum ada kamar</span>
                    </div>
                  </div>
                </div>

                <!-- Desktop Room Info -->
                <div class="hidden sm:flex items-center gap-2 text-sm w-48 shrink-0">
                  <UIcon name="i-heroicons-home" class="w-4 h-4" :class="getAssignedRoom(tenant) ? 'text-primary-500' : 'text-gray-300'" />
                  <span v-if="getAssignedRoom(tenant)" class="text-primary-600 dark:text-primary-400 font-medium truncate">
                    {{ getAssignedRoom(tenant).name }}
                  </span>
                  <span v-else class="text-gray-400 italic text-xs">Belum ada kamar</span>
                </div>

                <!-- Desktop Actions (Hover) -->
                <div class="hidden sm:flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <!-- <UButton color="warning" variant="ghost" icon="i-heroicons-key" size="sm" @click.stop="openResetPinModal(tenant)" title="Reset PIN" /> -->
                  <UButton color="neutral" variant="ghost" icon="i-heroicons-pencil-square" size="sm" @click.stop="openEditModal(tenant)" />
                  <UButton color="error" variant="ghost" icon="i-heroicons-trash" size="sm" @click.stop="openDeleteModal(tenant)" />
                </div>

                <!-- Mobile Actions (Bottom Row) -->
                <div class="sm:hidden w-full flex items-center justify-end gap-2 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
                    <!-- <UButton color="warning" variant="soft" icon="i-heroicons-key" size="xs" @click.stop="openResetPinModal(tenant)">Reset PIN</UButton> -->
                    <UButton color="neutral" variant="soft" icon="i-heroicons-pencil-square" size="xs" @click.stop="openEditModal(tenant)">Edit</UButton>
                    <UButton color="error" variant="soft" icon="i-heroicons-trash" size="xs" @click.stop="openDeleteModal(tenant)">Hapus</UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
        <UIcon name="i-heroicons-users" class="w-16 h-16 text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          {{ searchQuery || statusFilter !== '__all__' ? 'Tidak ada hasil' : 'Belum ada penghuni' }}
        </h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">
          {{ searchQuery || statusFilter !== '__all__' ? 'Coba ubah filter atau kata kunci pencarian.' : 'Mulai dengan menambah penghuni pertama Anda.' }}
        </p>
        <UButton v-if="!searchQuery && statusFilter === '__all__'" icon="i-heroicons-plus" @click="openAddModal">Tambah Penghuni</UButton>
    </div>



    <!-- Modal -->
    <TenantModal v-model="isModalOpen" :tenant="selectedTenant" @update:modelValue="onModalClose" />

    <!-- Reset PIN Confirmation Modal -->
    <UModal v-model:open="isResetPinModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-full">
                <UIcon name="i-heroicons-key" class="w-6 h-6 text-warning-500" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Reset PIN</h3>
                <p class="text-sm text-gray-500">Konfirmasi reset PIN penghuni</p>
              </div>
            </div>
          </template>
          
          <div class="space-y-4">
            <p class="text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin mereset PIN untuk <strong>{{ resetPinTenant?.name }}</strong>?
            </p>
            <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4 inline mr-1" />
                PIN akan dikembalikan ke <strong>4 digit terakhir</strong> nomor HP penghuni.
              </p>
            </div>
          </div>
          
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="outline" @click="isResetPinModalOpen = false" :disabled="resetPinLoading">
                Batal
              </UButton>
              <UButton color="warning" @click="confirmResetPin" :loading="resetPinLoading">
                <UIcon name="i-heroicons-key" class="w-4 h-4 mr-1" />
                Reset PIN
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="isDeleteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 bg-error-100 dark:bg-error-900/30 rounded-full">
                <UIcon name="i-heroicons-trash" class="w-6 h-6 text-error-500" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Hapus Penghuni</h3>
                <p class="text-sm text-gray-500">Konfirmasi penghapusan data</p>
              </div>
            </div>
          </template>
          
          <div class="space-y-4">
            <p class="text-gray-600 dark:text-gray-300">
              Apakah Anda yakin ingin menghapus <strong>{{ deleteTenant?.name }}</strong>?
            </p>
            <div class="p-3 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
              <p class="text-sm text-error-600 dark:text-error-400">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 inline mr-1" />
                Tindakan ini tidak dapat dibatalkan. Semua data penghuni akan dihapus permanen.
              </p>
            </div>
          </div>
          
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="outline" @click="isDeleteModalOpen = false" :disabled="deleteLoading">
                Batal
              </UButton>
              <UButton color="error" @click="confirmDelete" :loading="deleteLoading">
                <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-1" />
                Hapus
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
