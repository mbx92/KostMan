<script setup lang="ts">
const props = defineProps<{
  billId: string;
  billType: "rent" | "utility";
  totalAmount: number;
  paidAmount: number;
  isPaid: boolean;
}>();

const emit = defineEmits<{
  paymentAdded: [];
  close: [];
}>();

const toast = useToast();
const submitting = ref(false);

const remainingAmount = computed(() => props.totalAmount - props.paidAmount);

const form = reactive({
  amount: remainingAmount.value,
  paymentMethod: "cash" as
    | "cash"
    | "transfer"
    | "credit_card"
    | "debit_card"
    | "e_wallet"
    | "other",
  paymentDate: new Date().toISOString().split("T")[0],
  notes: "",
});

const paymentMethodOptions = [
  { label: "Tunai", value: "cash" },
  { label: "Transfer Bank", value: "transfer" },
  { label: "Kartu Kredit", value: "credit_card" },
  { label: "Kartu Debit", value: "debit_card" },
  { label: "E-Wallet", value: "e_wallet" },
  { label: "Lainnya", value: "other" },
];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

// Reset form on mount
onMounted(() => {
  form.amount = remainingAmount.value;
  form.paymentMethod = "cash";
  form.paymentDate = new Date().toISOString().split("T")[0];
  form.notes = "";
});

const handleSubmit = async () => {
  if (form.amount < 1 || form.amount > remainingAmount.value) {
    toast.add({
      title: "Jumlah Tidak Valid",
      description: `Jumlah harus antara Rp 1 sampai ${formatCurrency(remainingAmount.value)}`,
      color: "error",
    });
    return;
  }

  submitting.value = true;
  try {
    await $fetch("/api/payments", {
      method: "POST",
      body: {
        billId: props.billId,
        billType: props.billType,
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        notes: form.notes || undefined,
      },
    });

    toast.add({
      title: "Pembayaran Dicatat",
      description: "Pembayaran berhasil dicatat",
      color: "success",
    });

    emit("paymentAdded");
    emit("close");
  } catch (error: any) {
    toast.add({
      title: "Error",
      description: error?.data?.message || "Failed to record payment",
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <UCard class="max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Catat Pembayaran</h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          @click="emit('close')"
          square
        />
      </div>
    </template>

    <div class="space-y-4">
      <!-- Payment Summary -->
      <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">Total Tagihan</span>
          <span class="font-semibold">{{ formatCurrency(totalAmount) }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">Sudah Dibayar</span>
          <span class="font-semibold text-green-600 dark:text-green-400">
            {{ formatCurrency(paidAmount) }}
          </span>
        </div>
        <div
          class="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700"
        >
          <span class="text-gray-600 dark:text-gray-400">Sisa Tagihan</span>
          <span class="font-bold text-red-600 dark:text-red-400">
            {{ formatCurrency(remainingAmount) }}
          </span>
        </div>
      </div>

      <!-- Payment Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormField label="Jumlah Pembayaran" required>
          <UInput
            v-model.number="form.amount"
            type="number"
            :min="1"
            :max="remainingAmount"
            :step="1"
            icon="i-heroicons-banknotes"
            class="w-full"
          >
            <template #leading>Rp</template>
          </UInput>
          <template #help>
            <div class="flex gap-2 mt-2">
              <UButton
                size="xs"
                variant="soft"
                @click="form.amount = Math.floor(remainingAmount / 2)"
              >
                50%
              </UButton>
              <UButton
                size="xs"
                variant="soft"
                @click="form.amount = remainingAmount"
              >
                Lunas ({{ formatCurrency(remainingAmount) }})
              </UButton>
            </div>
          </template>
        </UFormField>

        <UFormField label="Metode Pembayaran" required>
          <USelect
            v-model="form.paymentMethod"
            :items="paymentMethodOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Tanggal Pembayaran" required>
          <UInput v-model="form.paymentDate" type="date" class="w-full" />
        </UFormField>

        <UFormField label="Catatan" help="Opsional">
          <UTextarea
            v-model="form.notes"
            :rows="2"
            placeholder="Tambahkan catatan..."
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            @click="emit('close')"
          >
            Batal
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="submitting"
            :disabled="form.amount < 1 || form.amount > remainingAmount"
          >
            Catat Pembayaran
          </UButton>
        </div>
      </form>
    </div>
  </UCard>
</template>
