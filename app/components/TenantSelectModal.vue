<script setup lang="ts">
import { useKosStore, type Tenant } from '~/stores/kos'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue', 'select'])

const store = useKosStore()
const { tenants, tenantsLoading } = storeToRefs(store)

const searchQuery = ref('')

// Filter tenants based on search
const filteredTenants = computed(() => {
  const activeTenants = tenants.value.filter(t => t.status === 'active')
  if (!searchQuery.value) return activeTenants
  const query = searchQuery.value.toLowerCase()
  return activeTenants.filter(t => 
    t.name.toLowerCase().includes(query) ||
    t.contact.toLowerCase().includes(query)
  )
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const selectTenant = (tenant: Tenant) => {
  emit('select', tenant)
  isOpen.value = false
}

const createNewTenant = () => {
  emit('select', null) // null means create new
  isOpen.value = false
}

// Fetch tenants when modal opens
watch(isOpen, (open) => {
  if (open) {
    store.fetchTenants()
    searchQuery.value = ''
  }
})
</script>

<template>
  <UModal v-model:open="isOpen" title="Select Tenant">
    <template #default />
    
    <template #content>
      <div class="p-4 space-y-4">
        <!-- Search Input -->
        <div class="relative">
          <UInput 
            v-model="searchQuery" 
            placeholder="Search tenant by name or contact..." 
            autofocus
            class="w-full"
          >
            <template #leading>
              <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 text-gray-400" />
            </template>
          </UInput>
        </div>

        <!-- Loading State -->
        <div v-if="tenantsLoading" class="py-8 text-center">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500 mx-auto" />
          <p class="text-sm text-gray-500 mt-2">Loading tenants...</p>
        </div>

        <!-- Tenant List -->
        <div v-else class="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          <button
            v-for="tenant in filteredTenants"
            :key="tenant.id"
            @click="selectTenant(tenant)"
            class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left rounded-lg"
          >
            <UAvatar :alt="tenant.name" size="sm" class="bg-primary-100 text-primary-600 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 dark:text-white truncate">{{ tenant.name }}</div>
              <div class="text-xs text-gray-500 truncate">{{ tenant.contact }}</div>
            </div>
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 shrink-0" />
          </button>

          <!-- Empty State -->
          <div v-if="filteredTenants.length === 0" class="py-8 text-center">
            <UIcon name="i-heroicons-user-group" class="w-10 h-10 text-gray-300 mx-auto" />
            <p class="text-sm text-gray-500 mt-2">
              {{ searchQuery ? 'No tenants match your search.' : 'No active tenants available.' }}
            </p>
          </div>
        </div>

        <!-- Create New Button -->
        <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
          <UButton 
            block 
            variant="soft" 
            color="primary"
            icon="i-heroicons-user-plus"
            @click="createNewTenant"
          >
            Create New Tenant
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
