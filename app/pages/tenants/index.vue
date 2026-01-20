<script setup lang="ts">
import { useKosStore, type Tenant, type Room } from '~/stores/kos'

const store = useKosStore()
const { tenants, rooms, tenantsLoading } = storeToRefs(store)
const toast = useToast()

const isModalOpen = ref(false)
const selectedTenant = ref(undefined)

// Reset PIN Modal
const isResetPinModalOpen = ref(false)
const resetPinTenant = ref<Tenant | null>(null)
const resetPinLoading = ref(false)

// Delete Modal
const isDeleteModalOpen = ref(false)
const deleteTenant = ref<Tenant | null>(null)
const deleteLoading = ref(false)

// Fetch data on mount
onMounted(async () => {
  await store.fetchTenants()
  await store.fetchRooms()
})

// Find room for a tenant - rooms store tenantId, so we look up room by tenantId
const getAssignedRoom = (tenantId: string): Room | null => {
  return rooms.value.find(r => r.tenantId === tenantId && r.status === 'occupied') || null
}

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
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-user-group" class="w-8 h-8 text-primary-500" />
           Tenants
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Manage your tenants directory.</p>
      </div>
      <UButton icon="i-heroicons-plus" size="lg" @click="openAddModal">Add Tenant</UButton>
    </div>

    <!-- Loading State -->
    <div v-if="tenantsLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <UCard v-for="i in 4" :key="i">
        <div class="space-y-3">
          <USkeleton class="h-10 w-10 rounded-full" />
          <USkeleton class="h-4 w-32" />
          <USkeleton class="h-3 w-24" />
        </div>
      </UCard>
    </div>

    <!-- Tenants Grid -->
    <div v-else-if="tenants.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <UCard 
        v-for="tenant in tenants" 
        :key="tenant.id"
        class="group hover:ring-2 hover:ring-primary-500/50 transition-all"
      >
        <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-3">
                 <UAvatar :alt="tenant.name" size="md" />
                 <div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ tenant.name }}</h3>
                    <p class="text-xs text-gray-500">{{ tenant.status }}</p>
                 </div>
            </div>
            <div class="flex gap-1">
                <UButton color="warning" variant="ghost" icon="i-heroicons-key" size="xs" @click="openResetPinModal(tenant)" title="Reset PIN" />
                <UButton color="neutral" variant="ghost" icon="i-heroicons-pencil-square" size="xs" @click="openEditModal(tenant)" />
                <UButton color="error" variant="ghost" icon="i-heroicons-trash" size="xs" @click="openDeleteModal(tenant)" />
            </div>
        </div>
        
        <div class="space-y-2 mt-4 text-sm">
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <UIcon name="i-heroicons-phone" class="w-4 h-4" />
                <span>{{ tenant.contact }}</span>
            </div>
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <UIcon name="i-heroicons-identification" class="w-4 h-4" />
                <span class="font-mono text-xs">{{ tenant.idCardNumber }}</span>
            </div>
             <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300" v-if="getAssignedRoom(tenant.id)">
                <UIcon name="i-heroicons-home" class="w-4 h-4" />
                <span class="text-primary-600 dark:text-primary-400 font-medium">Room {{ getAssignedRoom(tenant.id)?.name }}</span>
            </div>
            <div class="flex items-center gap-2 text-gray-400 italic" v-else>
                <UIcon name="i-heroicons-home" class="w-4 h-4" />
                <span>No room assigned</span>
            </div>
        </div>
      </UCard>
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
        <UIcon name="i-heroicons-users" class="w-16 h-16 text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No tenants yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">Start by adding your first tenant.</p>
        <UButton icon="i-heroicons-plus" @click="openAddModal">Add Tenant</UButton>
    </div>

    <!-- Modal -->
    <TenantModal v-model="isModalOpen" :tenant="selectedTenant" />

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

