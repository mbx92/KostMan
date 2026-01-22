<script setup lang="ts">
interface Props {
  expense: any
  formatCurrency: (value: number | string) => string
  formatDate: (date: string) => string
  getCategoryColor: (category: string) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [expense: any]
  markPaid: [id: string]
  delete: [id: string]
}>()

const isExpanded = ref(false)

const statusColor = computed(() => {
  return props.expense.isPaid ? 'success' : 'error'
})

const statusLabel = computed(() => {
  return props.expense.isPaid ? 'LUNAS' : 'BELUM DIBAYAR'
})
</script>

<template>
  <div class="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
    <!-- Collapsed Header -->
    <div class="p-4 cursor-pointer" @click="isExpanded = !isExpanded">
      <div class="flex items-start gap-3">
        <UIcon
          :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
          class="w-5 h-5 text-gray-400 mt-0.5 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <!-- Category + Date -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: getCategoryColor(expense.category) }" />
              <span class="font-bold text-gray-900 dark:text-white text-lg truncate">
                {{ expense.category }}
              </span>
            </div>
          </div>
          
          <div class="text-sm text-gray-500 mt-1">
             {{ formatDate(expense.expenseDate) }}
          </div>

          <!-- Status + Property -->
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <UBadge :color="statusColor" variant="subtle" size="xs">
              {{ statusLabel }}
            </UBadge>
            
            <span v-if="expense.type === 'global'" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
              Global
            </span>
            <span v-else-if="expense.propertyName" class="text-xs text-gray-500 flex items-center gap-1">
              <UIcon name="i-heroicons-home" class="w-3 h-3" />
              {{ expense.propertyName }}
            </span>
          </div>

          <!-- Amount -->
          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
             <div class="flex items-center justify-between">
                <div>
                   <div class="text-xs text-gray-500 mb-1">Total Pengeluaran</div>
                   <div class="text-2xl font-bold text-gray-900 dark:text-white">
                      {{ formatCurrency(expense.amount) }}
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Expanded Content -->
    <div v-show="isExpanded" class="border-t border-gray-100 dark:border-gray-800">
      <div class="p-4 bg-gray-50 dark:bg-gray-800/30 space-y-3">
        <!-- Description -->
        <div>
           <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Keterangan</span>
           <p class="text-sm text-gray-700 dark:text-gray-300">
             {{ expense.description }}
           </p>
        </div>
        
        <!-- Notes if any -->
        <div v-if="expense.notes">
           <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Catatan</span>
           <p class="text-sm text-gray-600 dark:text-gray-400 italic">
             {{ expense.notes }}
           </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="p-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800">
         <UButton
           size="sm"
           color="neutral"
           variant="ghost"
           icon="i-heroicons-pencil"
           @click.stop="emit('edit', expense)"
         >
           Edit
         </UButton>
         
         <UButton
           v-if="!expense.isPaid"
           size="sm"
           color="success"
           variant="ghost"
           icon="i-heroicons-check"
           @click.stop="emit('markPaid', expense.id)"
         >
           Tandai Lunas
         </UButton>

         <UButton
           size="sm"
           color="error"
           variant="ghost"
           icon="i-heroicons-trash"
           @click.stop="emit('delete', expense.id)"
         >
           Hapus
         </UButton>
      </div>
    </div>
  </div>
</template>
