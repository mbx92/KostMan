<script setup lang="ts">
const toast = useToast()

const statusFilter = ref<'pending' | 'all'>('pending')

const { data, pending: loading, refresh } = await useFetch('/api/payments/confirmations', {
  query: computed(() => ({ status: statusFilter.value })),
  watch: [statusFilter],
})

const payments = computed(() => data.value?.payments || [])

const pendingCount = computed(() => payments.value.filter(p => p.status === 'pending').length)

const formatCurrency = (val: number | string) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(val))

const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Extract proof image URL from notes
const getProofUrl = (notes: string | null) => {
  if (!notes) return null
  const match = notes.match(/Bukti transfer:\s*(\S+)/)
  return match ? match[1] : null
}

const confirmingId = ref<string | null>(null)
const rejectingId = ref<string | null>(null)
const previewUrl = ref<string | null>(null)
const previewOpen = computed({
  get: () => !!previewUrl.value,
  set: (v) => { if (!v) previewUrl.value = null },
})

// Detail modal
const detailPayment = ref<(typeof payments.value)[0] | null>(null)
const detailOpen = computed({
  get: () => !!detailPayment.value,
  set: (v) => { if (!v) detailPayment.value = null },
})

// Bill selection checkboxes
const confirmPrimary = ref(true)
const confirmPaired = ref(false)

watch(detailPayment, (p) => {
  confirmPrimary.value = true
  confirmPaired.value = !!p?.pairedBill && !p.pairedBill.isPaid
})

// Build billsToConfirm for current selection
const selectedBills = computed(() => {
  if (!detailPayment.value) return []
  const bills: Array<{ billId: string; billType: 'rent' | 'utility' }> = []
  if (confirmPrimary.value) bills.push({ billId: detailPayment.value.billId, billType: detailPayment.value.billType })
  if (confirmPaired.value && detailPayment.value.pairedBill) {
    bills.push({ billId: detailPayment.value.pairedBill.id, billType: detailPayment.value.pairedBill.billType })
  }
  return bills
})

// Extract plain notes (without proof URL line)
const getPlainNotes = (notes: string | null) => {
  if (!notes) return null
  const cleaned = notes.replace(/Bukti transfer:\s*\S+/g, '').trim()
  return cleaned || null
}

const confirmPayment = async (id: string, billsToConfirm?: Array<{ billId: string; billType: 'rent' | 'utility' }>) => {
  confirmingId.value = id
  try {
    await $fetch(`/api/payments/${id}/confirm`, {
      method: 'PATCH',
      body: billsToConfirm?.length ? { billsToConfirm } : {},
    })
    toast.add({ title: 'Berhasil', description: 'Pembayaran dikonfirmasi', color: 'success' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal', description: e?.data?.message || 'Terjadi kesalahan', color: 'error' })
  } finally {
    confirmingId.value = null
  }
}

const rejectPayment = async (id: string) => {
  rejectingId.value = id
  try {
    await $fetch(`/api/payments/${id}/reject`, { method: 'PATCH' })
    toast.add({ title: 'Ditolak', description: 'Bukti pembayaran ditolak', color: 'warning' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal', description: e?.data?.message || 'Terjadi kesalahan', color: 'error' })
  } finally {
    rejectingId.value = null
  }
}

const methodLabel: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  credit_card: 'Kartu Kredit',
  debit_card: 'Kartu Debit',
  e_wallet: 'E-Wallet',
  other: 'Lainnya',
}

const billTypeLabel: Record<string, string> = {
  rent: 'Sewa',
  utility: 'Utilitas',
}
</script>

<template>
  <div class="p-4 sm:p-8">
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Konfirmasi Pembayaran</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Verifikasi bukti transfer dan pembayaran cash dari penghuni.
        </p>
      </div>
      <div class="flex gap-3 items-center">
        <UBadge v-if="pendingCount > 0" color="warning" variant="solid" size="lg">
          {{ pendingCount }} menunggu konfirmasi
        </UBadge>
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'Menunggu Konfirmasi', value: 'pending' },
            { label: 'Semua Pembayaran', value: 'all' },
          ]"
          value-key="value"
          label-key="label"
          class="w-52"
        />
        <UButton icon="i-heroicons-arrow-path" color="neutral" variant="ghost" :loading="loading" @click="() => refresh()">
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && payments.length === 0" class="py-16 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
    </div>

    <!-- Empty -->
    <div v-else-if="payments.length === 0" class="py-16 text-center">
      <UIcon name="i-heroicons-check-circle" class="w-16 h-16 mx-auto text-green-400 mb-4" />
      <p class="text-xl font-semibold text-gray-700 dark:text-gray-200">Semua bersih!</p>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Tidak ada pembayaran yang perlu dikonfirmasi.</p>
    </div>

    <!-- Payment list -->
    <div v-else class="space-y-4">
      <UCard
        v-for="payment in payments"
        :key="payment.id"
        :class="payment.status === 'pending' ? 'border-l-4 border-l-amber-400 dark:border-l-amber-500' : 'border-l-4 border-l-green-400 dark:border-l-green-500'"
      >
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <!-- Left: Info -->
          <div class="flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :color="payment.status === 'pending' ? 'warning' : 'success'"
                variant="subtle"
              >
                {{ payment.status === 'pending' ? 'Menunggu Konfirmasi' : 'Dikonfirmasi' }}
              </UBadge>
              <UBadge color="neutral" variant="soft">
                {{ billTypeLabel[payment.billType] || payment.billType }}
              </UBadge>
              <UBadge color="info" variant="soft">
                {{ methodLabel[payment.paymentMethod] || payment.paymentMethod }}
              </UBadge>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1">
              <div>
                <span class="text-sm text-gray-500 dark:text-gray-400">Penghuni</span>
                <p class="font-semibold text-gray-900 dark:text-white">{{ payment.tenantName || '—' }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-500 dark:text-gray-400">Kamar</span>
                <p class="font-medium text-gray-700 dark:text-gray-300">
                  {{ payment.roomName || '—' }}
                  <span v-if="payment.propertyName" class="text-gray-400 text-sm"> · {{ payment.propertyName }}</span>
                </p>
              </div>
              <div v-if="payment.billPeriod">
                <span class="text-sm text-gray-500 dark:text-gray-400">Periode</span>
                <p class="font-medium text-gray-700 dark:text-gray-300">{{ payment.billPeriod }}</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>Dikirim: {{ formatDate(payment.createdAt) }}</span>
              <span v-if="payment.notes && !getProofUrl(payment.notes)">Catatan: {{ payment.notes }}</span>
            </div>

            <!-- Proof image link -->
            <div v-if="getProofUrl(payment.notes)" class="flex items-center gap-2">
              <UButton
                size="xs"
                color="primary"
                variant="outline"
                icon="i-heroicons-paper-clip"
                @click="previewUrl = getProofUrl(payment.notes)"
              >
                Lihat Bukti Transfer
              </UButton>
            </div>
          </div>

          <!-- Right: Amount + Actions -->
          <div class="flex flex-col items-end gap-3 shrink-0">
            <div class="text-right">
              <p class="text-sm text-gray-500 dark:text-gray-400">Jumlah dibayar</p>
              <div class="flex items-center justify-end gap-1.5">
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ formatCurrency(payment.amount) }}
                </p>
                <button
                  class="text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors mt-0.5"
                  title="Lihat detail pembayaran"
                  @click="detailPayment = payment"
                >
                  <UIcon name="i-heroicons-information-circle" class="w-5 h-5" />
                </button>
              </div>
              <p v-if="payment.billTotal" class="text-xs text-gray-400">
                dari {{ formatCurrency(payment.billTotal) }}
              </p>
            </div>

            <div v-if="payment.status === 'pending'" class="flex gap-2">
              <UButton
                size="sm"
                color="error"
                variant="outline"
                icon="i-heroicons-x-mark"
                :loading="rejectingId === payment.id"
                :disabled="confirmingId === payment.id"
                @click="rejectPayment(payment.id)"
              >
                Tolak
              </UButton>
              <UButton
                size="sm"
                color="success"
                icon="i-heroicons-check"
                :loading="confirmingId === payment.id"
                :disabled="rejectingId === payment.id"
                @click="confirmPayment(payment.id)"
              >
                Konfirmasi
              </UButton>
            </div>
            <div v-else class="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
              Sudah dikonfirmasi
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Detail modal -->
    <UModal v-model:open="detailOpen" title="Detail Pembayaran">
      <template #body>
        <div v-if="detailPayment" class="space-y-4">
          <!-- Status + type badges -->
          <div class="flex flex-wrap gap-2">
            <UBadge :color="detailPayment.status === 'pending' ? 'warning' : 'success'" variant="subtle">
              {{ detailPayment.status === 'pending' ? 'Menunggu Konfirmasi' : 'Dikonfirmasi' }}
            </UBadge>
            <UBadge color="neutral" variant="soft">
              {{ billTypeLabel[detailPayment.billType] || detailPayment.billType }}
            </UBadge>
            <UBadge color="info" variant="soft">
              {{ methodLabel[detailPayment.paymentMethod] || detailPayment.paymentMethod }}
            </UBadge>
          </div>

          <!-- Fields -->
          <div class="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
            <div class="flex justify-between py-2">
              <span class="text-gray-500">Penghuni</span>
              <span class="font-medium text-right">{{ detailPayment.tenantName || '—' }}</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-gray-500">Kamar</span>
              <span class="font-medium text-right">
                {{ detailPayment.roomName || '—' }}
                <span v-if="detailPayment.propertyName" class="text-gray-400"> · {{ detailPayment.propertyName }}</span>
              </span>
            </div>
            <div v-if="detailPayment.billPeriod" class="flex justify-between py-2">
              <span class="text-gray-500">Periode</span>
              <span class="font-medium">{{ detailPayment.billPeriod }}</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-gray-500">Jumlah Dibayar</span>
              <span class="font-bold text-gray-900 dark:text-white">{{ formatCurrency(detailPayment.amount) }}</span>
            </div>
            <div v-if="detailPayment.billTotal" class="flex justify-between py-2">
              <span class="text-gray-500">Total Tagihan</span>
              <span class="font-medium">{{ formatCurrency(detailPayment.billTotal) }}</span>
            </div>
            <div v-if="detailPayment.billTotal" class="flex justify-between py-2">
              <span class="text-gray-500">Sisa Tagihan</span>
              <span class="font-medium" :class="Number(detailPayment.billTotal) - Number(detailPayment.amount) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'">
                {{ formatCurrency(Math.max(0, Number(detailPayment.billTotal) - Number(detailPayment.amount))) }}
              </span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-gray-500">Dikirim pada</span>
              <span class="font-medium">{{ formatDate(detailPayment.createdAt) }}</span>
            </div>
            <div v-if="getPlainNotes(detailPayment.notes)" class="flex justify-between py-2">
              <span class="text-gray-500">Catatan</span>
              <span class="font-medium text-right max-w-48">{{ getPlainNotes(detailPayment.notes) }}</span>
            </div>
          </div>

          <!-- Proof image button -->
          <div v-if="getProofUrl(detailPayment.notes)" class="pt-1">
            <UButton
              block
              color="primary"
              variant="outline"
              icon="i-heroicons-paper-clip"
              @click="previewUrl = getProofUrl(detailPayment.notes); detailPayment = null"
            >
              Lihat Bukti Transfer
            </UButton>
          </div>

          <!-- Bill selection checkboxes for pending payments -->
          <div v-if="detailPayment.status === 'pending'" class="pt-2 space-y-2">
            <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Tandai tagihan sebagai lunas:</p>

            <!-- Primary bill -->
            <label
              class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="confirmPrimary
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'"
            >
              <input type="checkbox" v-model="confirmPrimary" class="w-4 h-4 accent-primary-500" />
              <div class="flex-1">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  Tagihan {{ billTypeLabel[detailPayment.billType] || detailPayment.billType }}
                </span>
              </div>
              <span class="text-sm font-bold text-gray-900 dark:text-white">
                {{ formatCurrency(detailPayment.billRemainingAmount || detailPayment.billTotal || 0) }}
              </span>
            </label>

            <!-- Paired bill (if exists and not paid) -->
            <label
              v-if="detailPayment.pairedBill && !detailPayment.pairedBill.isPaid"
              class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="confirmPaired
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'"
            >
              <input type="checkbox" v-model="confirmPaired" class="w-4 h-4 accent-primary-500" />
              <div class="flex-1">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  Tagihan {{ billTypeLabel[detailPayment.pairedBill.billType] || detailPayment.pairedBill.billType }}
                </span>
              </div>
              <span class="text-sm font-bold text-gray-900 dark:text-white">
                {{ formatCurrency(detailPayment.pairedBill.remainingAmount) }}
              </span>
            </label>

            <!-- Paired bill already paid notice -->
            <div
              v-if="detailPayment.pairedBill?.isPaid"
              class="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 px-1"
            >
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
              Tagihan {{ billTypeLabel[detailPayment.pairedBill.billType] }} sudah lunas
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <template v-if="detailPayment?.status === 'pending'">
            <UButton
              label="Tolak"
              color="error"
              variant="outline"
              icon="i-heroicons-x-mark"
              :loading="rejectingId === detailPayment?.id"
              @click="rejectPayment(detailPayment!.id); detailPayment = null"
            />
            <UButton
              label="Konfirmasi"
              color="success"
              icon="i-heroicons-check"
              :disabled="selectedBills.length === 0"
              :loading="confirmingId === detailPayment?.id"
              @click="confirmPayment(detailPayment!.id, selectedBills); detailPayment = null"
            />
          </template>
          <UButton label="Tutup" color="neutral" variant="outline" @click="detailPayment = null" />
        </div>
      </template>
    </UModal>

    <!-- Proof preview modal -->
    <UModal v-model:open="previewOpen" title="Bukti Transfer">
      <template #body>
        <div class="flex justify-center">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Bukti Transfer"
            class="max-w-full max-h-[70vh] rounded-lg object-contain"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between w-full">
          <UButton
            label="Buka di Tab Baru"
            color="neutral"
            variant="outline"
            icon="i-heroicons-arrow-top-right-on-square"
            :href="previewUrl || undefined"
            target="_blank"
          />
          <UButton label="Tutup" @click="previewUrl = null" />
        </div>
      </template>
    </UModal>
  </div>
</template>
