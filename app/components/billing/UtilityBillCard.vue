<script setup lang="ts">
import type { UtilityBill } from '~/stores/kos';

interface Props {
  bill: UtilityBill;
  formatCurrency: (value: number | string) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  markPaid: [id: string];
  payOnline: [id: string];
  print: [bill: UtilityBill];
  delete: [id: string];
  recordPayment: [id: string];
  viewPayments: [id: string];
}>();

const isExpanded = ref(false);

const billStatus = computed(() => {
  const total = Number(props.bill.totalAmount)
  const paid = Number(props.bill.paidAmount || 0)
  
  if (paid === 0) return 'BELUM DIBAYAR'
  if (paid >= total) return 'LUNAS'
  return 'DIBAYAR SEBAGIAN'
})

const billStatusColor = computed(() => {
  if (props.bill.isPaid) return 'success'
  const paid = Number(props.bill.paidAmount || 0)
  if (paid > 0) return 'warning'
  return 'error'
})

const remainingAmount = computed(() => {
  return Number(props.bill.totalAmount) - Number(props.bill.paidAmount || 0)
})

const kwhUsage = computed(() => {
  return (props.bill.meterEnd || 0) - (props.bill.meterStart || 0);
});

const periodFormatted = computed(() => {
  if (!props.bill.period) return '';
  const [year, month] = props.bill.period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
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
          
          <!-- Period -->
          <div class="text-sm text-gray-500 mt-0.5">
            {{ periodFormatted }}
          </div>
          
          <!-- Status + kWh -->
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <UBadge 
              :color="billStatusColor" 
              variant="subtle" 
              size="xs"
            >
              {{ billStatus }}
            </UBadge>
            <span class="text-xs text-gray-400">{{ kwhUsage }} kWh</span>
          </div>
          
          <!-- Amount (below) -->
          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs text-gray-500 mb-1">Total Tagihan</div>
                <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {{ formatCurrency(bill.totalAmount) }}
                </div>
                <div v-if="bill.paidAmount && Number(bill.paidAmount) > 0" class="mt-1 space-y-0.5">
                  <div class="text-xs text-green-600 dark:text-green-400">
                    Terbayar: {{ formatCurrency(bill.paidAmount) }}
                  </div>
                  <div v-if="!bill.isPaid" class="text-xs text-red-600 dark:text-red-400 font-medium">
                    Sisa: {{ formatCurrency(remainingAmount) }}
                  </div>
                </div>
              </div>
              <UButton
                v-if="!bill.isPaid && bill.paidAmount && Number(bill.paidAmount) > 0"
                icon="i-heroicons-banknotes"
                size="xs"
                color="primary"
                variant="soft"
                @click.stop="emit('viewPayments', bill.id)"
              >
                Riwayat
              </UButton>
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
              {{ periodFormatted }}
            </div>
          </div>
          <div>
            <span class="text-gray-500">Properti:</span>
            <div class="font-medium text-gray-900 dark:text-white">
              {{ bill.property?.name || 'Unknown' }}
            </div>
          </div>
        </div>
        
        <div class="h-px bg-gray-200 dark:bg-gray-700"></div>
        
        <!-- Meter Reading -->
        <div class="text-sm">
          <div class="text-gray-500 mb-1">Meteran Listrik:</div>
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ bill.meterStart }}</span>
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 text-gray-400" />
            <span class="font-medium">{{ bill.meterEnd }}</span>
            <span class="text-primary-600 dark:text-primary-400">({{ kwhUsage }} kWh)</span>
          </div>
        </div>
        
        <div class="h-px bg-gray-200 dark:bg-gray-700"></div>
        
        <!-- Breakdown -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Listrik ({{ kwhUsage }} kWh × {{ formatCurrency(bill.costPerKwh) }}):</span>
            <span class="font-medium">{{ formatCurrency(bill.usageCost) }}</span>
          </div>
          <div v-if="Number(bill.waterFee) > 0" class="flex justify-between">
            <span class="text-gray-500">Air:</span>
            <span class="font-medium">{{ formatCurrency(bill.waterFee) }}</span>
          </div>
          <div v-if="Number(bill.trashFee) > 0" class="flex justify-between">
            <span class="text-gray-500">Sampah:</span>
            <span class="font-medium">{{ formatCurrency(bill.trashFee) }}</span>
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
          icon="i-heroicons-banknotes"
          @click.stop="emit('recordPayment', bill.id)"
        >
          Catat Pembayaran
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
