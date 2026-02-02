<script setup lang="ts">
import { useKosStore } from '~/stores/kos'

const store = useKosStore()
const { properties, propertiesLoading, propertiesError } = storeToRefs(store)

const isModalOpen = ref(false)
const selectedProperty = ref(undefined) // For edit mode later

onMounted(() => {
  store.fetchProperties()
})

const openAddModal = () => {
  selectedProperty.value = undefined
  isModalOpen.value = true
}

const onModalClose = () => {
  // Refresh after modal closes in case a new property was added
  store.fetchProperties()
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-building-office-2" class="w-8 h-8 text-primary-500" />
           Properti
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola properti dan bangunan kos Anda.</p>
      </div>
      <UButton icon="i-heroicons-plus" size="lg" @click="openAddModal">Tambah Properti</UButton>
    </div>

    <!-- Error State -->
    <div v-if="propertiesError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-exclamation-circle" class="w-6 h-6 text-red-500" />
        <div>
          <h3 class="font-medium text-red-800 dark:text-red-200">Gagal memuat properti</h3>
          <p class="text-sm text-red-600 dark:text-red-400">{{ propertiesError }}</p>
        </div>
        <UButton size="sm" color="error" variant="soft" class="ml-auto" @click="store.fetchProperties()">
          Coba Lagi
        </UButton>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-else-if="propertiesLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
      <div 
        v-for="i in 3" 
        :key="i"
        class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
      >
        <USkeleton class="w-full aspect-[16/9]" />
        <div class="p-5 space-y-4">
          <USkeleton class="h-4 w-3/4" />
          <USkeleton class="h-3 w-1/2" />
          <div class="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between">
            <USkeleton class="h-4 w-20" />
            <USkeleton class="h-8 w-32" />
          </div>
        </div>
      </div>
    </div>

    <!-- Properties Grid -->
    <div v-else-if="properties.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
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
                    <span>{{ property.roomCount || 0 }} Kamar</span>
                </div>
                
                <UButton :to="`/properties/${property.id}`" variant="ghost" color="primary" trailing-icon="i-heroicons-arrow-right">
                    Kelola Properti
                </UButton>
            </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
        <UIcon name="i-heroicons-building-office-2" class="w-16 h-16 text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Belum ada properti</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-6">Mulai dengan menambahkan properti pertama Anda.</p>
        <UButton icon="i-heroicons-plus" @click="openAddModal">Tambah Properti</UButton>
    </div>

    <!-- Modal -->
    <PropertyModal v-model="isModalOpen" :property="selectedProperty" @update:modelValue="onModalClose" />
  </div>
</template>

