<script setup lang="ts">
import { useKosStore } from '~/stores/kos'

const store = useKosStore()
const { properties } = storeToRefs(store)

const isModalOpen = ref(false)
const selectedProperty = ref(undefined) // For edit mode later

const openAddModal = () => {
  selectedProperty.value = undefined
  isModalOpen.value = true
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-building-office-2" class="w-8 h-8 text-primary-500" />
           Properties
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Manage your kos properties and buildings.</p>
      </div>
      <UButton icon="i-heroicons-plus" size="lg" @click="openAddModal">Add Property</UButton>
    </div>

    <!-- Properties Grid -->
    <div v-if="properties.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
      <div 
        v-for="property in properties" 
        :key="property.id"
        class="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col h-full"
      >
        <!-- Image Section -->
        <div class="relative w-full aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img 
                :src="property.image" 
                class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                onerror="this.src='https://placehold.co/600x400?text=No+Image'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
            


            <!-- Property Name Overlay -->
            <div class="absolute bottom-4 left-4 right-4">
                <h3 class="text-xl font-bold text-white mb-0.5 truncate shadow-sm">{{ property.name }}</h3>
                <div class="flex items-center gap-1.5 text-gray-200 text-sm">
                    <UIcon name="i-heroicons-map-pin" class="w-4 h-4 shrink-0" />
                    <span class="truncate">{{ property.address }}</span>
                </div>
            </div>
        </div>
        
        <!-- Content -->
        <div class="p-5 flex-1 flex flex-col justify-between">
            <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                {{ property.description }}
            </p>

            <div class="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm text-gray-500">
                    <UIcon name="i-heroicons-home" class="w-4 h-4" />
                    <span>{{ store.getRoomsByPropertyId(property.id).length }} Rooms</span>
                </div>
                
                <UButton :to="`/properties/${property.id}`" variant="ghost" color="primary" trailing-icon="i-heroicons-arrow-right">
                    Manage Property
                </UButton>
            </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
        <UIcon name="i-heroicons-building-office-2" class="w-16 h-16 text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">No properties yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">Start by adding your first property to manage.</p>
        <UButton icon="i-heroicons-plus" @click="openAddModal">Add Property</UButton>
    </div>

    <!-- Modal -->
    <PropertyModal v-model="isModalOpen" :property="selectedProperty" />
  </div>
</template>
