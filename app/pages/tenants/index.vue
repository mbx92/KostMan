<script setup lang="ts">
import { useKosStore, type Tenant } from '~/stores/kos'

const store = useKosStore()
const { tenants } = storeToRefs(store)

const isModalOpen = ref(false)
const selectedTenant = ref(undefined)

const openAddModal = () => {
  selectedTenant.value = undefined
  isModalOpen.value = true
}

const openEditModal = (tenant: any) => {
  selectedTenant.value = tenant
  isModalOpen.value = true
}

const handleDelete = (id: string) => {
  if (confirm('Are you sure you want to delete this tenant?')) {
    store.deleteTenant(id)
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

    <!-- Tenants Grid -->
    <div v-if="tenants.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                <UButton color="neutral" variant="ghost" icon="i-heroicons-pencil-square" size="xs" @click="openEditModal(tenant)" />
                <UButton color="error" variant="ghost" icon="i-heroicons-trash" size="xs" @click="handleDelete(tenant.id)" />
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
             <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300" v-if="tenant.roomId">
                <UIcon name="i-heroicons-home" class="w-4 h-4" />
                <span class="text-primary-600 dark:text-primary-400 font-medium">Room {{ store.rooms.find(r => r.id === tenant.roomId)?.name || 'Unknown' }}</span>
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
  </div>
</template>
