<script setup lang="ts">
import ConfirmDialog from "~/components/ConfirmDialog.vue";

const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

// Modals
const expenseModalOpen = ref(false)
const selectedExpense = ref<any>(null)

// Fetch properties for filter
const { data: propertiesData } = useFetch('/api/properties')
const properties = computed(() => propertiesData.value || [])

// Filters
const selectedPropertyId = ref('all')
const selectedType = ref<'all' | 'property' | 'global'>('all')
const selectedCategory = ref('all')
const selectedStatus = ref<'all' | 'paid' | 'unpaid'>('all')

// Fetch categories
const { data: categoriesData } = useFetch('/api/expenses/categories')
const allCategories = computed(() => {
  const defaults = categoriesData.value?.categories?.default || []
  const custom = categoriesData.value?.categories?.custom || []
  return [...defaults, ...custom]
})

const propertyOptions = computed(() => [
  { label: 'Semua Properti', value: 'all' },
  { label: 'Pengeluaran Global', value: 'global' },
  ...properties.value.map((p: any) => ({ label: p.name, value: p.id }))
])

const categoryOptions = computed(() => [
  { label: 'Semua Kategori', value: 'all' },
  ...allCategories.value.map((c: any) => ({ label: c.name, value: c.name }))
])

// Pagination
const page = ref(1)
const pageCount = ref(10)

// Computed Query Params
const queryParams = computed(() => {
  const params: any = {
    page: page.value,
    limit: pageCount.value
  }

  if (selectedPropertyId.value !== 'all') {
    params.propertyId = selectedPropertyId.value
  }

  if (selectedType.value !== 'all') {
    params.type = selectedType.value
  }

  if (selectedCategory.value !== 'all') {
    params.category = selectedCategory.value
  }

  if (selectedStatus.value !== 'all') {
    params.isPaid = selectedStatus.value === 'paid' ? 'true' : 'false'
  }

  return params
})

// Watch filters to reset page
watch([selectedPropertyId, selectedType, selectedCategory, selectedStatus], () => {
  page.value = 1
})

// Fetch expenses
const { data: expensesData, pending: expensesLoading, refresh: refreshExpenses } = useFetch('/api/expenses', {
  query: queryParams,
  watch: [page, selectedPropertyId, selectedType, selectedCategory, selectedStatus]
})

const expenses = computed(() => expensesData.value?.expenses || [])
const totalExpensesCount = computed(() => expensesData.value?.pagination?.total || 0)

// Used for display in table (direct mapping as server now handles filtering/sorting)
const filteredExpenses = expenses

// Stats
const totalExpenses = computed(() => expensesData.value?.stats?.totalAmount || 0)
const totalPaid = computed(() => expensesData.value?.stats?.totalPaid || 0)
const totalUnpaid = computed(() => expensesData.value?.stats?.totalUnpaid || 0)

// Actions
const openAddExpense = () => {
  selectedExpense.value = null
  expenseModalOpen.value = true
}

const openEditExpense = (expense: any) => {
  selectedExpense.value = expense
  expenseModalOpen.value = true
}

const deleteExpense = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Pengeluaran?',
    message: 'Apakah Anda yakin ingin menghapus pengeluaran ini? Tindakan ini tidak dapat dibatalkan.',
    confirmText: 'Ya, Hapus',
    confirmColor: 'error'
  })
  
  if (!confirmed) return

  try {
    await $fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    toast.add({
      title: 'Pengeluaran Dihapus',
      description: 'Pengeluaran berhasil dihapus.',
      color: 'success'
    })
    await refreshExpenses()
  } catch (e: any) {
    toast.add({
      title: 'Gagal',
      description: e?.data?.message || 'Gagal menghapus pengeluaran',
      color: 'error'
    })
  }
}

const markAsPaid = async (id: string) => {
  try {
    await $fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      body: {
        isPaid: true,
        paidDate: new Date().toISOString().split('T')[0]
      }
    })
    toast.add({
      title: 'Ditandai Lunas',
      description: 'Pengeluaran telah ditandai sebagai lunas.',
      color: 'success'
    })
    await refreshExpenses()
  } catch (e: any) {
    toast.add({
      title: 'Gagal',
      description: e?.data?.message || 'Gagal memperbarui pengeluaran',
      color: 'error'
    })
  }
}

const formatCurrency = (val: number | string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(val))

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const getCategoryColor = (categoryName: string) => {
  const category = allCategories.value.find((c: any) => c.name === categoryName)
  return category?.color || '#6b7280'
}

const onExpenseSaved = async () => {
  await refreshExpenses()
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Pengeluaran</h1>
        <p class="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Pantau dan kelola pengeluaran bisnis Anda</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <UButton
          label="Kelola Kategori"
          icon="i-heroicons-tag"
          color="neutral"
          variant="outline"
          to="/expenses/categories"
          class="w-full sm:w-auto justify-center"
        />
        <UButton
          label="Tambah Pengeluaran"
          icon="i-heroicons-plus"
          color="primary"
          @click="openAddExpense"
          class="w-full sm:w-auto justify-center"
        />
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Total Pengeluaran</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ formatCurrency(totalExpenses) }}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Sudah Dibayar</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{{ formatCurrency(totalPaid) }}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Belum Dibayar</p>
            <p class="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{{ formatCurrency(totalUnpaid) }}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <UIcon name="i-heroicons-exclamation-circle" class="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Properti</label>
          <USelect 
            v-model="selectedPropertyId" 
            :items="propertyOptions" 
            value-key="value" 
            label-key="label"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
          <USelect 
            v-model="selectedCategory" 
            :items="categoryOptions" 
            value-key="value" 
            label-key="label"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe</label>
          <USelect 
            v-model="selectedType" 
            :items="[
              { label: 'Semua Tipe', value: 'all' },
              { label: 'Properti', value: 'property' },
              { label: 'Global', value: 'global' }
            ]" 
            value-key="value" 
            label-key="label"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <USelect 
            v-model="selectedStatus" 
            :items="[
              { label: 'Semua Status', value: 'all' },
              { label: 'Lunas', value: 'paid' },
              { label: 'Belum Dibayar', value: 'unpaid' }
            ]" 
            value-key="value" 
            label-key="label"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- Expenses Table - Desktop -->
    <div class="hidden md:block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deskripsi</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Properti</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jumlah</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-if="expensesLoading">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto" />
              </td>
            </tr>
            <tr v-else-if="filteredExpenses.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                Tidak ada pengeluaran ditemukan
              </td>
            </tr>
            <template v-else>
              <tr v-for="expense in filteredExpenses" :key="expense.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {{ formatDate(expense.expenseDate) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: getCategoryColor(expense.category) }" />
                  <span class="text-sm text-gray-900 dark:text-white">{{ expense.category }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                {{ expense.description }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <span v-if="expense.type === 'global'" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                  Global
                </span>
                <span v-else>{{ expense.propertyName || '-' }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {{ formatCurrency(expense.amount) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span v-if="expense.isPaid" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                  Lunas
                </span>
                <span v-else class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                  Belum Dibayar
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <UButton 
                    icon="i-heroicons-pencil" 
                    size="sm"
                    color="neutral" 
                    variant="ghost"
                    @click="openEditExpense(expense)"
                  />
                  <UButton 
                    v-if="!expense.isPaid"
                    icon="i-heroicons-check" 
                    size="sm"
                    color="success" 
                    variant="ghost"
                    @click="markAsPaid(expense.id)"
                  />
                  <UButton 
                    icon="i-heroicons-trash" 
                    size="sm"
                    color="error" 
                    variant="ghost"
                    @click="deleteExpense(expense.id)"
                  />
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Expenses Cards - Mobile -->
    <div class="md:hidden space-y-3">
      <div v-if="expensesLoading" class="bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin mx-auto text-gray-500" />
      </div>
      <div v-else-if="filteredExpenses.length === 0" class="bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
        Tidak ada pengeluaran ditemukan
      </div>
      
      <ExpensesExpenseCard 
        v-else 
        v-for="expense in filteredExpenses" 
        :key="expense.id"
        :expense="expense"
        :format-currency="formatCurrency"
        :format-date="formatDate"
        :get-category-color="getCategoryColor"
        @edit="openEditExpense"
        @mark-paid="markAsPaid"
        @delete="deleteExpense"
      />
    </div>

    <!-- Pagination -->
    <div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
      <UPagination
        v-model:page="page"
        :items-per-page="pageCount"
        :total="totalExpensesCount"
      />
    </div>

    <!-- Expense Modal -->
    <ExpenseModal
      v-model="expenseModalOpen"
      :expense="selectedExpense"
      :properties="properties"
      :categories="allCategories"
      @saved="onExpenseSaved"
    />
    
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
