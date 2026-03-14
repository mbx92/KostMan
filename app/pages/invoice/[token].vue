<script setup lang="ts">
definePageMeta({
  layout: false, // No auth required
});

const route = useRoute();
const token = route.params.token as string;
const toast = useToast();

// Fetch app settings for app name
const { data: settings } = await useFetch("/api/settings");

// Fetch bill data
const {
  data: billData,
  error,
  pending,
} = await useFetch(`/api/bills/public/${token}`);

// Midtrans Snap
const payingBill = ref(false);
const downloadingPdf = ref(false);

// Upload proof
const uploadProofModal = ref(false);
const uploadFile = ref<File | null>(null);
const uploadingProof = ref(false);
const proofUploaded = ref(false);

const isMidtransEnabled = computed(() => billData.value?.midtransEnabled === true);

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  uploadFile.value = input.files?.[0] ?? null;
};

const uploadProof = async () => {
  if (!uploadFile.value || !billData.value) return;
  uploadingProof.value = true;
  try {
    const formData = new FormData();
    formData.append("file", uploadFile.value);
    await $fetch(`/api/bills/upload-proof/${token}`, {
      method: "POST",
      body: formData,
    });
    proofUploaded.value = true;
    uploadProofModal.value = false;
    uploadFile.value = null;
    toast.add({
      title: "Berhasil",
      description: "Bukti transfer berhasil dikirim",
      color: "success",
    });
  } catch (e: any) {
    toast.add({
      title: "Gagal Upload",
      description: e?.data?.message || "Terjadi kesalahan saat upload bukti",
      color: "error",
    });
  } finally {
    uploadingProof.value = false;
  }
};

// Format currency
const formatCurrency = (val: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(val));

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Pay online
const payOnline = async () => {
  if (!billData.value) return;

  payingBill.value = true;

  try {
    // Determine payment parameters based on type
    let requestBody: any;

    if (billData.value.billType === "combined") {
      // For combined, send roomId and period
      requestBody = {
        billType: "combined",
        roomId: billData.value.room?.id,
        period:
          billData.value.rentBill?.period || billData.value.utilityBill?.period,
      };
    } else {
      // For single bill
      requestBody = {
        billId: billData.value.bill.id,
        billType: billData.value.billType,
      };
    }

    const response = await $fetch<{
      success: boolean;
      snapToken: string;
      clientKey: string;
    }>("/api/payments/midtrans/create-public", {
      method: "POST",
      body: requestBody,
    });

    if (response.success && response.snapToken) {
      // Load Midtrans Snap script if not loaded
      const snapUrl = "https://app.sandbox.midtrans.com/snap/snap.js";

      const loadSnapScript = () => {
        return new Promise<void>((resolve, reject) => {
          if (window.snap) {
            resolve();
            return;
          }

          const script = document.createElement("script");
          script.src = snapUrl;
          script.setAttribute("data-client-key", response.clientKey);
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Snap"));
          document.body.appendChild(script);
        });
      };

      await loadSnapScript();

      window.snap.pay(response.snapToken, {
        onSuccess: () => {
          toast.add({
            title: "Pembayaran Berhasil",
            description: "Menunggu konfirmasi pembayaran...",
            color: "success",
          });
          // Wait for webhook to process, then reload
          setTimeout(() => window.location.reload(), 3000);
        },
        onPending: () => {
          toast.add({
            title: "Pembayaran Pending",
            description: "Silakan selesaikan pembayaran Anda",
            color: "warning",
          });
          payingBill.value = false;
        },
        onError: () => {
          toast.add({
            title: "Pembayaran Gagal",
            description: "Terjadi kesalahan",
            color: "error",
          });
          payingBill.value = false;
        },
        onClose: () => {
          payingBill.value = false;
        },
      });
    }
  } catch (e: any) {
    console.error("Payment error:", e);
    toast.add({
      title: "Error",
      description: e?.data?.message || "Gagal membuat transaksi",
      color: "error",
    });
    payingBill.value = false;
  }
};

// Download PDF
const downloadPdf = async () => {
  if (!billData.value) return;

  downloadingPdf.value = true;

  try {
    let roomId, period;

    if (billData.value.billType === "combined") {
      roomId = billData.value.room?.id;
      period =
        billData.value.rentBill?.period || billData.value.utilityBill?.period;
    } else {
      roomId = billData.value.room?.id;
      period = billData.value.bill?.period;
    }

    // Fetch PDF using native fetch for better blob handling
    const response = await fetch("/api/bills/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomId, period }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate PDF");
    }

    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${period}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.add({
      title: "Berhasil",
      description: "PDF berhasil didownload",
      color: "success",
    });
  } catch (e: any) {
    console.error("PDF download error:", e);
    toast.add({
      title: "Error",
      description: "Gagal download PDF",
      color: "error",
    });
  } finally {
    downloadingPdf.value = false;
  }
};

// Declare Snap global
declare global {
  interface Window {
    snap: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center min-h-screen">
      <UIcon
        name="i-heroicons-arrow-path"
        class="w-8 h-8 animate-spin text-primary-500"
      />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="w-16 h-16 text-red-500 mb-4"
      />
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Invoice Tidak Ditemukan
      </h1>
      <p class="text-gray-500 dark:text-gray-400">
        Link yang Anda gunakan tidak valid atau sudah kedaluwarsa.
      </p>
    </div>

    <!-- Invoice Content -->
    <div v-else-if="billData" class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Content -->
      <div class="max-w-3xl mx-auto p-6 space-y-6">
        <!-- App Logo & Name -->
        <div class="text-center">
          <div class="flex justify-center mb-3">
            <UIcon
              name="i-heroicons-building-office-2"
              class="w-16 h-16 text-primary-600 dark:text-primary-400"
            />
          </div>
          <h1 class="text-3xl font-bold text-primary-600 dark:text-primary-400">
            {{ settings?.appName || "KostMan" }}
          </h1>
        </div>

        <!-- Header -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                Invoice Tagihan
              </h2>
              <p class="text-gray-500 dark:text-gray-400 mt-1">
                {{ billData.property?.name }}
              </p>
            </div>
            <UBadge
              :color="
                billData.billType === 'combined'
                  ? billData.rentBill?.isPaid && billData.utilityBill?.isPaid
                    ? 'success'
                    : Number(billData.rentBill?.paidAmount || 0) > 0 ||
                        Number(billData.utilityBill?.paidAmount || 0) > 0
                      ? 'warning'
                      : 'error'
                  : billData.bill?.isPaid
                    ? 'success'
                    : Number(billData.bill?.paidAmount || 0) > 0
                      ? 'warning'
                      : 'error'
              "
              variant="subtle"
              size="lg"
            >
              {{
                billData.billType === "combined"
                  ? billData.rentBill?.isPaid && billData.utilityBill?.isPaid
                    ? "LUNAS"
                    : Number(billData.rentBill?.paidAmount || 0) > 0 ||
                        Number(billData.utilityBill?.paidAmount || 0) > 0
                      ? "DIBAYAR SEBAGIAN"
                      : "BELUM LUNAS"
                  : billData.bill?.isPaid
                    ? "LUNAS"
                    : Number(billData.bill?.paidAmount || 0) > 0
                      ? "DIBAYAR SEBAGIAN"
                      : "BELUM LUNAS"
              }}
            </UBadge>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-500 dark:text-gray-400">Kamar</p>
              <p class="font-semibold text-gray-900 dark:text-white">
                {{ billData.room?.name }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Penghuni</p>
              <p class="font-semibold text-gray-900 dark:text-white">
                {{ billData.tenant?.name }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Periode</p>
              <p class="font-semibold text-gray-900 dark:text-white">
                {{
                  billData.billType === "combined"
                    ? billData.rentBill?.period || billData.utilityBill?.period
                    : billData.bill.period
                }}
              </p>
            </div>
            <div
              v-if="
                billData.billType === 'combined'
                  ? billData.rentBill?.paidAt || billData.utilityBill?.paidAt
                  : billData.bill?.paidAt
              "
            >
              <p class="text-gray-500 dark:text-gray-400">Dibayar Tanggal</p>
              <p class="font-semibold text-gray-900 dark:text-white">
                {{
                  formatDate(
                    billData.billType === "combined"
                      ? billData.rentBill?.paidAt ||
                          billData.utilityBill?.paidAt
                      : billData.bill.paidAt,
                  )
                }}
              </p>
            </div>
          </div>

          <!-- Partial Payment Info -->
          <div
            v-if="
              (billData.billType === 'combined'
                ? Number(billData.rentBill?.paidAmount || 0) > 0 ||
                  Number(billData.utilityBill?.paidAmount || 0) > 0
                : Number(billData.bill?.paidAmount || 0) > 0) &&
              !(billData.billType === 'combined'
                ? billData.rentBill?.isPaid && billData.utilityBill?.isPaid
                : billData.bill?.isPaid)
            "
            class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div
              class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 space-y-2"
            >
              <h4
                class="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-clock" class="w-5 h-5" />
                Pembayaran Cicilan
              </h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-amber-700 dark:text-amber-300">
                    Sudah Dibayar
                  </p>
                  <p class="font-bold text-green-600 dark:text-green-400">
                    {{
                      formatCurrency(
                        billData.billType === "combined"
                          ? Number(billData.rentBill?.paidAmount || 0) +
                              Number(billData.utilityBill?.paidAmount || 0)
                          : Number(billData.bill?.paidAmount || 0),
                      )
                    }}
                  </p>
                </div>
                <div>
                  <p class="text-amber-700 dark:text-amber-300">Sisa Tagihan</p>
                  <p class="font-bold text-red-600 dark:text-red-400">
                    {{
                      formatCurrency(
                        billData.billType === "combined"
                          ? Number(billData.rentBill?.totalAmount || 0) -
                              Number(billData.rentBill?.paidAmount || 0) +
                              (Number(billData.utilityBill?.totalAmount || 0) -
                                Number(billData.utilityBill?.paidAmount || 0))
                          : Number(billData.bill?.totalAmount || 0) -
                              Number(billData.bill?.paidAmount || 0),
                      )
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bill Details -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Rincian Tagihan
          </h2>

          <div class="space-y-4">
            <!-- Combined Bills -->
            <template v-if="billData.billType === 'combined'">
              <!-- Rent Bill -->
              <div v-if="billData.rentBill">
                <div
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      Sewa Kamar
                    </p>
                    <p class="text-sm text-gray-500">
                      {{ billData.rentBill.monthsCovered || 1 }} bulan
                      <span v-if="billData.rentBill.periodEnd">
                        ({{ billData.rentBill.period }} -
                        {{ billData.rentBill.periodEnd }})
                      </span>
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.rentBill.roomPrice) }}
                  </p>
                </div>

                <!-- Water Fee (if included in rent bill) -->
                <div
                  v-if="Number(billData.rentBill.waterFee || 0) > 0 && !billData.utilityBill"
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="text-gray-700 dark:text-gray-300">Air</p>
                    <p
                      class="text-sm text-gray-500"
                      v-if="
                        billData.room?.occupantCount &&
                        billData.rentBill.monthsCovered
                      "
                    >
                      Rp 25.000 x {{ billData.room.occupantCount }} orang x
                      {{ billData.rentBill.monthsCovered }} bulan
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.rentBill.waterFee) }}
                  </p>
                </div>

                <!-- Trash Fee (if included in rent bill) -->
                <div
                  v-if="Number(billData.rentBill.trashFee || 0) > 0 && !billData.utilityBill"
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="text-gray-700 dark:text-gray-300">Sampah</p>
                    <p
                      class="text-sm text-gray-500"
                      v-if="billData.rentBill.monthsCovered"
                    >
                      Rp 10.000 x {{ billData.rentBill.monthsCovered }} bulan
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.rentBill.trashFee) }}
                  </p>
                </div>
              </div>

              <!-- Utility Bill -->
              <div v-if="billData.utilityBill">
                <div
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      Listrik
                    </p>
                    <p class="text-sm text-gray-500 font-mono">
                      {{ billData.utilityBill.meterStart }} →
                      {{ billData.utilityBill.meterEnd }} =
                      {{
                        billData.utilityBill.meterEnd -
                        billData.utilityBill.meterStart
                      }}
                      kWh × {{ formatCurrency(billData.utilityBill.costPerKwh) }}
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.utilityBill.usageCost) }}
                  </p>
                </div>

                <div
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="text-gray-700 dark:text-gray-300">Air</p>
                    <p class="text-sm text-gray-500">
                      {{
                        formatCurrency(
                          Number(billData.utilityBill.waterFee) /
                            (billData.room?.occupantCount || 1),
                        )
                      }}
                      x {{ billData.room?.occupantCount || 1 }} orang
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.utilityBill.waterFee) }}
                  </p>
                </div>

                <div
                  v-if="Number(billData.utilityBill.trashFee) > 0"
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <p class="text-gray-700 dark:text-gray-300">Sampah</p>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.utilityBill.trashFee) }}
                  </p>
                </div>
              </div>

              <!-- Total Combined -->
              <div
                class="flex justify-between items-center py-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-4 mt-4"
              >
                <p class="text-lg font-bold text-gray-900 dark:text-white">
                  TOTAL
                </p>
                <p
                  class="text-2xl font-bold text-primary-600 dark:text-primary-400"
                >
                  {{
                    formatCurrency(
                      Number(billData.rentBill?.totalAmount || 0) +
                        Number(billData.utilityBill?.totalAmount || 0),
                    )
                  }}
                </p>
              </div>
            </template>

            <!-- Single Bill (Original) -->
            <template v-else>
              <!-- Rent Bill -->
              <div v-if="billData.billType === 'rent'">
                <div
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      Sewa Kamar
                    </p>
                    <p class="text-sm text-gray-500">
                      {{ billData.bill.monthsCovered || 1 }} bulan
                      <span v-if="billData.bill.periodEnd">
                        ({{ billData.bill.period }} -
                        {{ billData.bill.periodEnd }})
                      </span>
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.bill.roomPrice) }}
                  </p>
                </div>

                <div
                  v-if="Number(billData.bill.waterFee) > 0"
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="text-gray-700 dark:text-gray-300">Air</p>
                    <p
                      class="text-sm text-gray-500"
                      v-if="
                        billData.room?.occupantCount &&
                        billData.bill.monthsCovered
                      "
                    >
                      Rp 25.000 x {{ billData.room.occupantCount }} orang x
                      {{ billData.bill.monthsCovered }} bulan
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.bill.waterFee) }}
                  </p>
                </div>

                <div
                  v-if="Number(billData.bill.trashFee) > 0"
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="text-gray-700 dark:text-gray-300">Sampah</p>
                    <p
                      class="text-sm text-gray-500"
                      v-if="billData.bill.monthsCovered"
                    >
                      Rp 10.000 x {{ billData.bill.monthsCovered }} bulan
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.bill.trashFee) }}
                  </p>
                </div>
              </div>

              <!-- Utility Bill -->
              <div v-if="billData.billType === 'utility'">
                <div
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      Listrik
                    </p>
                    <p class="text-sm text-gray-500 font-mono">
                      {{ billData.bill.meterStart }} →
                      {{ billData.bill.meterEnd }} =
                      {{
                        billData.bill.meterEnd - billData.bill.meterStart
                      }}
                      kWh × {{ formatCurrency(billData.bill.costPerKwh) }}
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.bill.usageCost) }}
                  </p>
                </div>

                <div
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p class="text-gray-700 dark:text-gray-300">Air</p>
                    <p class="text-sm text-gray-500">
                      {{
                        formatCurrency(
                          Number(billData.bill.waterFee) /
                            (billData.room?.occupantCount || 1),
                        )
                      }}
                      x {{ billData.room?.occupantCount || 1 }} orang
                    </p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.bill.waterFee) }}
                  </p>
                </div>

                <div
                  v-if="Number(billData.bill.trashFee) > 0"
                  class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700"
                >
                  <p class="text-gray-700 dark:text-gray-300">Sampah</p>
                  <p class="font-semibold text-gray-900 dark:text-white">
                    {{ formatCurrency(billData.bill.trashFee) }}
                  </p>
                </div>
              </div>

              <!-- Total -->
              <div
                class="flex justify-between items-center py-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-4 mt-4"
              >
                <p class="text-lg font-bold text-gray-900 dark:text-white">
                  TOTAL
                </p>
                <p
                  class="text-2xl font-bold text-primary-600 dark:text-primary-400"
                >
                  {{ formatCurrency(billData.bill.totalAmount) }}
                </p>
              </div>
            </template>
          </div>
        </div>

        <!-- Actions -->
        <div
          v-if="
            billData.billType === 'combined'
              ? !billData.rentBill?.isPaid || !billData.utilityBill?.isPaid
              : !billData.bill?.isPaid
          "
          class="space-y-3"
        >
          <div
            class="grid gap-3"
            :class="isMidtransEnabled ? 'grid-cols-2' : 'grid-cols-1'"
          >
            <UButton
              v-if="isMidtransEnabled"
              block
              size="lg"
              color="primary"
              icon="i-heroicons-credit-card"
              :loading="payingBill"
              @click="payOnline"
            >
              Bayar Sekarang
            </UButton>
            <UButton
              block
              size="lg"
              color="gray"
              variant="outline"
              icon="i-heroicons-arrow-down-tray"
              :loading="downloadingPdf"
              @click="downloadPdf"
            >
              Download PDF
            </UButton>
          </div>
          <div v-if="!proofUploaded">
            <UButton
              block
              size="lg"
              color="success"
              variant="outline"
              icon="i-heroicons-paper-clip"
              @click="uploadProofModal = true"
            >
              Upload Bukti Transfer
            </UButton>
          </div>
          <div
            v-else
            class="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 text-sm py-2"
          >
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
            <span>Bukti transfer sudah dikirim, menunggu konfirmasi</span>
          </div>
        </div>
        <div v-else class="flex justify-center">
          <UButton
            size="lg"
            color="gray"
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            :loading="downloadingPdf"
            @click="downloadPdf"
          >
            Download Kwitansi
          </UButton>
        </div>

        <!-- Footer -->
        <div class="text-center text-sm text-gray-500 dark:text-gray-400 pt-4">
          <p>Terima kasih atas pembayaran Anda</p>
          <p class="mt-1">{{ billData.property?.name }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Upload Proof Modal -->
  <UModal v-model:open="uploadProofModal" title="Upload Bukti Transfer">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Upload foto atau screenshot bukti transfer pembayaran Anda. Format yang
          didukung: JPG, PNG, WebP, GIF, PDF (maks. 5MB).
        </p>
        <div
          class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center"
        >
          <UIcon
            name="i-heroicons-arrow-up-tray"
            class="w-8 h-8 mx-auto text-gray-400 mb-2"
          />
          <label class="cursor-pointer">
            <span class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
              Pilih file
            </span>
            <input
              type="file"
              accept="image/*,.pdf"
              class="hidden"
              @change="handleFileChange"
            />
          </label>
          <p class="text-xs text-gray-500 mt-1">atau drag & drop di sini</p>
        </div>
        <div
          v-if="uploadFile"
          class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2"
        >
          <UIcon name="i-heroicons-paper-clip" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ uploadFile.name }}</span>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-3 justify-end w-full">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="uploadProofModal = false"
        />
        <UButton
          label="Kirim Bukti"
          icon="i-heroicons-paper-airplane"
          :disabled="!uploadFile"
          :loading="uploadingProof"
          @click="uploadProof"
        />
      </div>
    </template>
  </UModal>
</template>
