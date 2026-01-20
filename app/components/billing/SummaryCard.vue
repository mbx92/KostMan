<script setup lang="ts">
import type { RentBill, UtilityBill } from '~/stores/kos';

interface CombinedItem {
  period: string;
  roomId: string;
  rent?: RentBill;
  util?: UtilityBill;
}

interface Props {
  item: CombinedItem;
  formatCurrency: (value: number | string) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  sendWhatsApp: [item: CombinedItem];
  print: [item: CombinedItem];
}>();

const isExpanded = ref(false);

const roomName = computed(() => 
  props.item.rent?.room?.name || props.item.util?.room?.name || 'Unknown'
);

const propertyName = computed(() => 
  props.item.rent?.property?.name || props.item.util?.property?.name || 'Unknown'
);

const tenantName = computed(() => 
  props.item.rent?.tenant?.name || props.item.util?.tenant?.name || 'No Tenant'
);

const rentAmount = computed(() => Number(props.item.rent?.totalAmount || 0));
const utilityAmount = computed(() => Number(props.item.util?.totalAmount || 0));
const totalAmount = computed(() => rentAmount.value + utilityAmount.value);

const status = computed(() => {
  const rentPaid = props.item.rent?.isPaid !== false;
  const utilPaid = props.item.util?.isPaid !== false;
  
  if (rentPaid && utilPaid) return 'PAID';
  if (props.item.rent?.isPaid || props.item.util?.isPaid) return 'PARTIAL';
  return 'UNPAID';
});

const statusColor = computed(() => {
  if (status.value === 'PAID') return 'success';
  if (status.value === 'PARTIAL') return 'warning';
  return 'error';
});

const periodFormatted = computed(() => {
  if (!props.item.period) return '';
  const [year, month] = props.item.period.split('-');
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
              {{ roomName }}
            </span>
            <span class="text-gray-400">•</span>
            <span class="text-sm text-gray-500">
              {{ tenantName }}
            </span>
          </div>
          
          <!-- Property + Period -->
          <div class="text-sm text-gray-500 mt-0.5">
            {{ propertyName }} • {{ periodFormatted }}
          </div>
          
          <!-- Status -->
          <div class="flex items-center gap-2 mt-2">
            <UBadge :color="statusColor" variant="subtle" size="xs">
              {{ status }}
            </UBadge>
          </div>
          
          <!-- Amount (below) -->
          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {{ formatCurrency(totalAmount) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Expanded Content -->
    <div v-show="isExpanded" class="border-t border-gray-100 dark:border-gray-800">
      <!-- Bill Details -->
      <div class="p-4 space-y-3 bg-gray-50 dark:bg-gray-800/30">
        <!-- Breakdown -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between items-center">
            <span class="text-gray-500">Sewa Kamar:</span>
            <div class="flex items-center gap-1">
              <span class="font-medium">{{ item.rent ? formatCurrency(rentAmount) : '-' }}</span>
              <UIcon 
                v-if="item.rent"
                :name="item.rent.isPaid ? 'i-heroicons-check-circle' : 'i-heroicons-clock'" 
                :class="item.rent.isPaid ? 'text-success-500' : 'text-warning-500'"
                class="w-4 h-4"
              />
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">Utilitas (Listrik/Air):</span>
            <div class="flex items-center gap-1">
              <span class="font-medium">{{ item.util ? formatCurrency(utilityAmount) : '-' }}</span>
              <UIcon 
                v-if="item.util"
                :name="item.util.isPaid ? 'i-heroicons-check-circle' : 'i-heroicons-clock'" 
                :class="item.util.isPaid ? 'text-success-500' : 'text-warning-500'"
                class="w-4 h-4"
              />
            </div>
          </div>
          <div class="h-px bg-gray-200 dark:bg-gray-700"></div>
          <div class="flex justify-between font-bold">
            <span class="text-gray-900 dark:text-white">Total:</span>
            <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(totalAmount) }}</span>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="p-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800">
        <UButton 
          size="sm" 
          color="success" 
          variant="soft"
          icon="i-heroicons-chat-bubble-left-ellipsis"
          @click.stop="emit('sendWhatsApp', item)"
        >
          WhatsApp
        </UButton>
        <UButton 
          size="sm" 
          color="primary" 
          variant="soft"
          icon="i-heroicons-printer"
          @click.stop="emit('print', item)"
        >
          Print
        </UButton>
      </div>
    </div>
  </div>
</template>
