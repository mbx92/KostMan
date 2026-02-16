<script setup lang="ts">
import ConfirmDialog from '~/components/ConfirmDialog.vue'

const props = defineProps<{
  billId: string
  billType: 'rent' | 'utility'
}>()

const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

// Fetch payments
const { data: paymentsData, refresh: refreshPayments } = await useAuthFetch('/api/payments', {
  query: {
    billId: props.billId,
    billType: props.billType,
  },
})

const payments = computed(() => paymentsData.value?.payments || [])

const formatCurrency = (val: number | string) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(val))

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    credit_card: 'Kartu Kredit',
    debit_card: 'Kartu Debit',
    e_wallet: 'E-Wallet',
    other: 'Lainnya',
  }
  return labels[method] || method
}

const deletePayment = async (paymentId: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Pembayaran?',
    message: 'Apakah Anda yakin ingin menghapus catatan pembayaran ini? Saldo tagihan akan disesuaikan.',
    confirmText: 'Ya, Hapus',
    confirmColor: 'error',
  })

  if (!confirmed) return

  try {
    await $fetch(`/api/payments/${paymentId}`, { method: 'DELETE' })
    toast.add({
      title: 'Payment Deleted',
      description: 'Payment record has been removed',
      color: 'success',
    })
    await refreshPayments()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to delete payment',
      color: 'error',
    })
  }
}

defineExpose({ refreshPayments })
</script>

<template>
  <div class="space-y-3">
    <div v-if="payments.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-banknotes" class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p class="text-sm">Belum ada pembayaran tercatat</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="payment in payments"
        :key="payment.id"
        class="flex items-start justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-gray-900 dark:text-white">
              {{ formatCurrency(payment.amount) }}
            </span>
            <UBadge size="xs" color="neutral">
              {{ getPaymentMethodLabel(payment.paymentMethod) }}
            </UBadge>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatDate(payment.paymentDate) }}
            <span v-if="payment.recordedByName" class="ml-1">
              • by {{ payment.recordedByName }}
            </span>
          </p>
          <p v-if="payment.notes" class="text-xs text-gray-600 dark:text-gray-300 mt-1">
            {{ payment.notes }}
          </p>
        </div>
        <UButton
          icon="i-heroicons-trash"
          size="xs"
          color="error"
          variant="ghost"
          @click="deletePayment(payment.id)"
        />
      </div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
