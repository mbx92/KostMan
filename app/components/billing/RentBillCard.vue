<script setup lang="ts">
import type { RentBill } from '~/stores/kos';

interface Props {
  bill: RentBill;
  formatCurrency: (value: number | string) => string;
  formatDateRange: (start: string, end: string) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  markPaid: [id: string];
  payOnline: [id: string];
  print: [bill: RentBill];
  delete: [id: string];
}>();

const isExpanded = ref(false);

const daysCount = computed(() => {
  if (!props.bill.periodStartDate || !props.bill.periodEndDate) return 0;
  const [startY, startM, startD] = props.bill.periodStartDate.split('-').map(Number);
  const [endY, endM, endD] = props.bill.periodEndDate.split('-').map(Number);
  const start = new Date(startY, startM - 1, startD);
  const end = new Date(endY, endM - 1, endD);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
});

const dueDateFormatted = computed(() => {
  if (!props.bill.dueDate) return '';
  return new Date(props.bill.dueDate).toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
});
</script>

<template>
  <div class="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
    <!-- Collapsed Header (always visible) -->
    <div 
      class="p-4 cursor-pointer"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-start gap-3">
        <UIcon 
          :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
          class="w-5 h-5 text-gray-400 mt-0.5 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <!-- Room + Tenant -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-gray-900 dark:text-white text-lg">
              {{ bill.room?.name || 'Unknown' }}
            </span>
            <span class="text-gray-400">•</span>
            <span class="text-sm text-gray-500">
              {{ bill.tenant?.name || 'Belum Ada Penghuni' }}
            </span>
          </div>
          
          <!-- Property -->
          <div class="text-sm text-gray-500 mt-0.5">
            {{ bill.property?.name || 'Unknown Property' }}
          </div>
          
          <!-- Status + Due Date -->
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <UBadge 
              :color="bill.isPaid ? 'success' : 'warning'" 
              variant="subtle" 
              size="xs"
            >
              {{ bill.isPaid ? 'LUNAS' : 'BELUM LUNAS' }}
            </UBadge>
            <span class="text-xs text-gray-400">Jatuh Tempo: {{ dueDateFormatted }}</span>
          </div>
          
          <!-- Amount (below) -->
          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {{ formatCurrency(bill.totalAmount) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Expanded Content -->
    <div v-show="isExpanded" class="border-t border-gray-100 dark:border-gray-800">
      <!-- Bill Details -->
      <div class="p-4 space-y-3 bg-gray-50 dark:bg-gray-800/30">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-gray-500">Periode:</span>
            <div class="font-medium text-gray-900 dark:text-white">
              {{ formatDateRange(bill.periodStartDate, bill.periodEndDate) }}
            </div>
          </div>
          <div>
            <span class="text-gray-500">Durasi:</span>
            <div class="font-medium text-gray-900 dark:text-white">
              {{ daysCount }} hari ({{ bill.monthsCovered || 1 }} bulan)
            </div>
          </div>
        </div>
        
        <div class="h-px bg-gray-200 dark:bg-gray-700"></div>
        
        <!-- Breakdown -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Sewa Kamar:</span>
            <span class="font-medium">{{ formatCurrency(bill.roomPrice) }}</span>
          </div>
          <div v-if="Number(bill.waterFee) > 0" class="flex justify-between">
            <span class="text-gray-500">Air:</span>
            <span class="font-medium">{{ formatCurrency(bill.waterFee) }}</span>
          </div>
          <div v-if="Number(bill.trashFee) > 0" class="flex justify-between">
            <span class="text-gray-500">Sampah:</span>
            <span class="font-medium">{{ formatCurrency(bill.trashFee) }}</span>
          </div>
          <div v-if="Number(bill.additionalCost) > 0" class="flex justify-between">
            <span class="text-gray-500">Biaya Tambahan:</span>
            <span class="font-medium">{{ formatCurrency(bill.additionalCost) }}</span>
          </div>
          <div class="h-px bg-gray-200 dark:bg-gray-700"></div>
          <div class="flex justify-between font-bold">
            <span class="text-gray-900 dark:text-white">Total:</span>
            <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(bill.totalAmount) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="p-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800">
        <UButton 
          v-if="!bill.isPaid"
          size="sm" 
          color="primary" 
          variant="soft"
          icon="i-heroicons-credit-card"
          @click.stop="emit('payOnline', bill.id)"
        >
          Bayar Online
        </UButton>
        <UButton 
          v-if="!bill.isPaid"
          size="sm" 
          color="success" 
          variant="soft"
          icon="i-heroicons-check"
          @click.stop="emit('markPaid', bill.id)"
        >
          Tandai Lunas
        </UButton>
        <UButton 
          size="sm" 
          color="neutral" 
          variant="ghost"
          icon="i-heroicons-printer"
          @click.stop="emit('print', bill)"
        >
          Cetak
        </UButton>
        <UButton 
          v-if="!bill.isPaid"
          size="sm" 
          color="red" 
          variant="ghost"
          icon="i-heroicons-trash"
          @click.stop="emit('delete', bill.id)"
        />
      </div>
    </div>
  </div>
</template>
