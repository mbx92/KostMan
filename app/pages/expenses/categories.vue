<script setup lang="ts">
import ConfirmDialog from "~/components/ConfirmDialog.vue";

const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

// Modals
const categoryModalOpen = ref(false)
const selectedCategory = ref<any>(null)

// Fetch categories
const { data: categoriesData, pending: categoriesLoading, refresh: refreshCategories } = await useAuthFetch('/api/expenses/categories')

const defaultCategories = computed(() => categoriesData.value?.categories?.default || [])
const customCategories = computed(() => categoriesData.value?.categories?.custom || [])

// Actions
const openAddCategory = () => {
  selectedCategory.value = null
  categoryModalOpen.value = true
}

const openEditCategory = (category: any) => {
  selectedCategory.value = category
  categoryModalOpen.value = true
}

const deleteCategory = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Kategori?',
    message: 'Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan.',
    confirmText: 'Ya, Hapus',
    confirmColor: 'error'
  })
  
  if (!confirmed) return

  try {
    await $fetch(`/api/expenses/categories/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Kategori Dihapus',
      description: 'Kategori berhasil dihapus.',
      color: 'success'
    })
    await refreshCategories()
  } catch (e: any) {
    toast.add({
      title: 'Gagal',
      description: e?.data?.message || 'Gagal menghapus kategori',
      color: 'error'
    })
  }
}

const toggleActive = async (category: any) => {
  try {
    await $fetch(`/api/expenses/categories/${category.id}`, {
      method: 'PATCH',
      body: {
        isActive: !category.isActive
      }
    })
    toast.add({
      title: 'Kategori Diperbarui',
      description: `Kategori berhasil ${category.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`,
      color: 'success'
    })
    await refreshCategories()
  } catch (e: any) {
    toast.add({
      title: 'Gagal',
      description: e?.data?.message || 'Gagal memperbarui kategori',
      color: 'error'
    })
  }
}

const onCategorySaved = async () => {
  await refreshCategories()
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="flex items-center gap-3">
          <UButton
            icon="i-heroicons-arrow-left"
            color="neutral"
            variant="ghost"
            to="/expenses"
          />
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Kategori Pengeluaran</h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola kategori pengeluaran kustom Anda</p>
          </div>
        </div>
      </div>
      <UButton
        label="Tambah Kategori"
        icon="i-heroicons-plus"
        color="primary"
        @click="openAddCategory"
      />
    </div>

    <!-- Default Categories -->
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Kategori Bawaan</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Kategori bawaan sistem yang tidak dapat diedit atau dihapus</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="category in defaultCategories"
          :key="category.name"
          class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" :style="{ backgroundColor: category.color + '20' }">
                <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: category.color }" />
              </div>
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">{{ category.name }}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ category.description }}</p>
              </div>
            </div>
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Bawaan
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Categories -->
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Kategori Kustom</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Kategori pengeluaran pribadi Anda</p>
      </div>

      <div v-if="categoriesLoading" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto text-gray-400" />
      </div>

      <div v-else-if="customCategories.length === 0" class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
        <UIcon name="i-heroicons-tag" class="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">Belum ada kategori kustom</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">Buat kategori kustom pertama Anda untuk memulai</p>
        <UButton label="Tambah Kategori" icon="i-heroicons-plus" color="primary" @click="openAddCategory" />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="category in customCategories"
          :key="category.id"
          class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
          :class="{ 'opacity-50': !category.isActive }"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3 flex-1">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" :style="{ backgroundColor: category.color + '20' }">
                <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: category.color }" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-900 dark:text-white truncate">{{ category.name }}</h3>
                <p v-if="category.description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ category.description }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <UButton 
                icon="i-heroicons-pencil" 
                size="sm"
                color="neutral" 
                variant="ghost"
                @click="openEditCategory(category)"
              />
              <UButton 
                :icon="category.isActive ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" 
                size="sm"
                color="neutral" 
                variant="ghost"
                @click="toggleActive(category)"
              />
              <UButton 
                icon="i-heroicons-trash" 
                size="sm"
                color="error" 
                variant="ghost"
                @click="deleteCategory(category.id)"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span v-if="category.isActive" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
              Aktif
            </span>
            <span v-else class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Tidak Aktif
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <ExpenseCategoryModal
      v-model="categoryModalOpen"
      :category="selectedCategory"
      @saved="onCategorySaved"
    />
    
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
