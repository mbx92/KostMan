<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { useKosStore, type RentBill, type UtilityBill } from "~/stores/kos";
import { usePdfReceipt } from "~/composables/usePdfReceipt";
import ConfirmDialog from "~/components/ConfirmDialog.vue";
import DatePicker from "~/components/DatePicker.vue";

const store = useKosStore();
const toast = useToast();

const {
  rentBills,
  rentBillsLoading,
  utilityBills,
  utilityBillsLoading,
  rooms,
  properties,
  settings,
  meterReadings,
  tenants,
} = storeToRefs(store);
const { generateRentReceipt, generateUtilityReceipt, generateCombinedReceipt } =
  usePdfReceipt();

// Confirm Dialog
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

// Fetch data on mount
const dueSoonReminders = ref<any[]>([]);
const dueSoonLoading = ref(false);

async function fetchDueSoonReminders() {
  dueSoonLoading.value = true;
  try {
    const data = await $fetch<{ count: number; items: any[] }>('/api/reminders/due-soon');
    dueSoonReminders.value = data.items;
  } catch (e) {
    console.error('Failed to fetch due-soon reminders:', e);
  } finally {
    dueSoonLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchRentBills(),
    store.fetchUtilityBills(),
    store.fetchRooms(),
    store.fetchProperties(),
    store.fetchSettings(),
    store.fetchTenants(),
    fetchDueSoonReminders(),
  ]);
});

// Tab state
const activeTab = ref<"rent" | "utility" | "summary">("rent");

// Filters
const selectedPropertyId = ref("all");
const selectedRoomId = ref("all");
const selectedStatus = ref<"all" | "paid" | "unpaid">("all");

const propertyOptions = computed(() => [
  { label: "All Properties", value: "all" },
  ...properties.value.map((p) => ({ label: p.name, value: p.id })),
]);

const roomOptions = computed(() => {
  const baseRooms =
    selectedPropertyId.value !== "all"
      ? rooms.value.filter((r) => r.propertyId === selectedPropertyId.value)
      : rooms.value;
  return [
    { label: "All Rooms", value: "all" },
    ...baseRooms.map((r) => ({ label: r.name, value: r.id })),
  ];
});

// Filtered Bills
const selectedPeriod = ref<string | null>(null);

const filteredRentBills = computed(() => {
  let result = [...rentBills.value];
  if (selectedRoomId.value !== "all") {
    result = result.filter((b) => b.roomId === selectedRoomId.value);
  } else if (selectedPropertyId.value !== "all") {
    const roomIds = rooms.value
      .filter((r) => r.propertyId === selectedPropertyId.value)
      .map((r) => r.id);
    result = result.filter((b) => roomIds.includes(b.roomId));
  }

  if (selectedPeriod.value) {
    const filterPeriod = selectedPeriod.value.slice(0, 7);
    result = result.filter((b) => b.period.startsWith(filterPeriod));
  }

  if (selectedStatus.value === "paid") result = result.filter((b) => b.isPaid);
  if (selectedStatus.value === "unpaid")
    result = result.filter((b) => !b.isPaid);
  return result.sort(
    (a, b) => new Date(b.period).getTime() - new Date(a.period).getTime()
  );
});

const filteredUtilityBills = computed(() => {
  let result = [...utilityBills.value];
  if (selectedRoomId.value !== "all") {
    result = result.filter((b) => b.roomId === selectedRoomId.value);
  } else if (selectedPropertyId.value !== "all") {
    const roomIds = rooms.value
      .filter((r) => r.propertyId === selectedPropertyId.value)
      .map((r) => r.id);
    result = result.filter((b) => roomIds.includes(b.roomId));
  }

  // Filter by period (YYYY-MM)
  if (selectedPeriod.value) {
    const filterPeriod = selectedPeriod.value.slice(0, 7);
    result = result.filter((b) => b.period.startsWith(filterPeriod));
  }

  if (selectedStatus.value === "paid") result = result.filter((b) => b.isPaid);
  if (selectedStatus.value === "unpaid")
    result = result.filter((b) => !b.isPaid);
  return result.sort(
    (a, b) => new Date(b.period).getTime() - new Date(a.period).getTime()
  );
});

const combinedBills = computed(() => {
  const map = new Map<
    string,
    { period: string; roomId: string; rent?: RentBill; util?: UtilityBill }
  >();

  filteredRentBills.value.forEach((b) => {
    const key = `${b.roomId}-${b.period}`;
    if (!map.has(key)) map.set(key, { period: b.period, roomId: b.roomId });
    map.get(key)!.rent = b;
  });

  filteredUtilityBills.value.forEach((b) => {
    const key = `${b.roomId}-${b.period}`;
    if (!map.has(key)) map.set(key, { period: b.period, roomId: b.roomId });
    map.get(key)!.util = b;
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.period).getTime() - new Date(a.period).getTime()
  );
});

// Stats
const totalUnpaidRent = computed(() =>
  filteredRentBills.value
    .filter((b) => !b.isPaid)
    .reduce((sum, b) => sum + Number(b.totalAmount), 0)
);
const totalUnpaidUtility = computed(() =>
  filteredUtilityBills.value
    .filter((b) => !b.isPaid)
    .reduce((sum, b) => sum + Number(b.totalAmount), 0)
);
const totalUnpaid = computed(
  () => totalUnpaidRent.value + totalUnpaidUtility.value
);

// Generate Rent Bill Form
const isGenerating = ref(false);
const genPropertyId = ref("");
const genRoomId = ref("");
const genPeriodStartDate = ref(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
const genMonthsCovered = ref(1);

// Calculate period end date (start + 1 month - 1 day)
const genPeriodEndDate = computed(() => {
  if (!genPeriodStartDate.value) return '';
  const start = new Date(genPeriodStartDate.value);
  const end = new Date(start);
  end.setMonth(end.getMonth() + genMonthsCovered.value);
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
});

// Due date = period end date
const genDueDate = computed(() => genPeriodEndDate.value);

// Auto-set to next billing cycle based on moveInDate
const setNextBillingCycle = () => {
  if (!genRoom.value?.moveInDate) return;
  
  // Parse moveInDate correctly (avoid timezone issues)
  // moveInDate is in format "YYYY-MM-DD"
  const [year, month, day] = genRoom.value.moveInDate.split('-').map(Number);
  const cycleDay = day; // Day of month from moveInDate (e.g., 18)
  
  // Find next available start date
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  
  // Start with current month's cycle day
  let nextStartYear = todayYear;
  let nextStartMonth = todayMonth;
  
  // If cycle day has already passed this month, move to next month
  if (todayDay > cycleDay) {
    nextStartMonth++;
    if (nextStartMonth > 11) {
      nextStartMonth = 0;
      nextStartYear++;
    }
  }
  
  // Format as YYYY-MM-DD
  let nextStartDate = `${nextStartYear}-${String(nextStartMonth + 1).padStart(2, '0')}-${String(cycleDay).padStart(2, '0')}`;
  
  // Check if this period already has a bill, skip if overlapped
  const existingBills = rentBills.value.filter(b => b.roomId === genRoomId.value);
  
  for (const bill of existingBills) {
    const billStart = new Date(bill.periodStartDate + 'T00:00:00');
    const billEnd = new Date(bill.periodEndDate + 'T00:00:00');
    const checkDate = new Date(nextStartDate + 'T00:00:00');
    
    // If nextStart falls within existing bill period, move to after that bill
    if (checkDate >= billStart && checkDate <= billEnd) {
      const afterBillEnd = new Date(billEnd);
      afterBillEnd.setDate(afterBillEnd.getDate() + 1);
      nextStartDate = afterBillEnd.toISOString().slice(0, 10);
    }
  }
  
  genPeriodStartDate.value = nextStartDate;
};

// Filtered room options for generate modal based on selected property
const genRoomOptions = computed(() => {
  const baseRooms = genPropertyId.value
    ? rooms.value.filter((r) => r.propertyId === genPropertyId.value)
    : rooms.value;
  return baseRooms
    .filter((r) => r.status === 'occupied') // Only show occupied rooms
    .map((r) => {
      const tenant = tenants.value.find((t) => t.id === r.tenantId);
      const tenantName = tenant?.name || r.tenantName || '';
      return { 
        label: tenantName ? `${r.name} - ${tenantName}` : r.name, 
        value: r.id 
      };
    });
});

const genRoom = computed(() =>
  rooms.value.find((r) => r.id === genRoomId.value)
);

// Get tenant for selected room
const genTenant = computed(() => {
  if (!genRoom.value?.tenantId) return null;
  return tenants.value.find(t => t.id === genRoom.value?.tenantId);
});

// Get existing rent bills for selected room (for date range display)
const existingRentBillRanges = computed(() => {
  if (!genRoomId.value) return [];
  return rentBills.value
    .filter(b => b.roomId === genRoomId.value)
    .map(b => ({
      start: b.periodStartDate,
      end: b.periodEndDate,
      formatted: formatDateRange(b.periodStartDate, b.periodEndDate)
    }));
});

// Helper to format date range
const formatDateRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${s.toLocaleDateString('id-ID', opts)} - ${e.toLocaleDateString('id-ID', opts)}`;
};

// Calculate disabled dates based on moveInDate and existing bills (date-based)
const isDateUnavailable = computed(() => {
  return (date: DateValue) => {
    const checkDate = new Date(date.year, date.month - 1, date.day);
    
    // If room has moveInDate, don't allow dates before moveInDate
    if (genRoom.value?.moveInDate) {
      const moveInDate = new Date(genRoom.value.moveInDate);
      if (checkDate < moveInDate) {
        return true;
      }
    }
    
    // Check if date falls within any existing billing period
    for (const bill of rentBills.value.filter(b => b.roomId === genRoomId.value)) {
      const start = new Date(bill.periodStartDate);
      const end = new Date(bill.periodEndDate);
      if (checkDate >= start && checkDate <= end) {
        return true;
      }
    }
    
    return false;
  };
});

// Set default start date based on moveInDate when room changes
watch([genRoomId, genRoom], () => {
  if (genRoom.value?.moveInDate) {
    // Auto-set to next billing cycle
    setNextBillingCycle();
  }
});

// Check if selected date range conflicts with existing bills
const dateRangeConflict = computed(() => {
  if (!genPeriodStartDate.value || !genPeriodEndDate.value || !genRoomId.value) return null;
  
  const newStart = new Date(genPeriodStartDate.value);
  const newEnd = new Date(genPeriodEndDate.value);
  
  for (const bill of rentBills.value.filter(b => b.roomId === genRoomId.value)) {
    const existStart = new Date(bill.periodStartDate);
    const existEnd = new Date(bill.periodEndDate);
    
    // Check overlap: ranges overlap if start1 <= end2 AND end1 >= start2
    if (newStart <= existEnd && newEnd >= existStart) {
      return formatDateRange(bill.periodStartDate, bill.periodEndDate);
    }
  }
  
  return null;
});

const generateRentBill = async () => {
  if (!genRoomId.value || !genRoom.value) return;
  
  // Check for date range conflicts
  if (dateRangeConflict.value) {
    toast.add({
      title: "Conflict",
      description: `Periode ${dateRangeConflict.value} sudah memiliki rent bill. Pilih tanggal lain atau hapus rent bill yang lama terlebih dahulu.`,
      color: "error",
    });
    return;
  }
  
  try {
    await store.generateRentBill({
      roomId: genRoomId.value,
      periodStartDate: genPeriodStartDate.value,
      monthsCovered: genMonthsCovered.value,
      roomPrice: Number(genRoom.value.price),
    });
    await store.fetchRentBills(); // Refresh list to get enriched data
    toast.add({
      title: "Success",
      description: "Rent bill generated.",
      color: "success",
    });
    isGenerating.value = false;
    genRoomId.value = "";
  } catch (e: any) {
    toast.add({
      title: "Error",
      description: e?.data?.message || e?.message || "Failed to generate",
      color: "error",
    });
  }
};

// Actions
const markRentPaid = async (id: string) => {
  try {
    await store.markRentBillAsPaid(id);
    toast.add({
      title: "Paid",
      description: "Rent bill marked as paid.",
      color: "success",
    });
  } catch (e: any) {
    toast.add({
      title: "Error",
      description: e?.data?.message || e?.message,
      color: "error",
    });
  }
};

// Midtrans Payment
declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess?: (result: any) => void;
        onPending?: (result: any) => void;
        onError?: (result: any) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

const payingBillId = ref<string | null>(null);

const payOnline = async (billId: string, billType: 'rent' | 'utility') => {
  if (!window.snap) {
    toast.add({
      title: "Error",
      description: "Payment gateway not loaded. Please refresh the page.",
      color: "error",
    });
    return;
  }

  payingBillId.value = billId;
  
  try {
    const response = await $fetch<{
      success: boolean;
      snapToken: string;
      redirectUrl: string;
      orderId: string;
    }>('/api/payments/midtrans/create', {
      method: 'POST',
      body: { billId, billType },
    });

    if (response.success && response.snapToken) {
      window.snap.pay(response.snapToken, {
        onSuccess: async (result: any) => {
          console.log('Payment success:', result);
          toast.add({
            title: "Pembayaran Berhasil",
            description: "Tagihan sudah dibayar.",
            color: "success",
          });
          // Refresh bills
          await store.fetchRentBills();
          await store.fetchUtilityBills();
          payingBillId.value = null;
        },
        onPending: (result: any) => {
          console.log('Payment pending:', result);
          toast.add({
            title: "Pembayaran Pending",
            description: "Silakan selesaikan pembayaran Anda.",
            color: "warning",
          });
          payingBillId.value = null;
        },
        onError: (result: any) => {
          console.error('Payment error:', result);
          toast.add({
            title: "Pembayaran Gagal",
            description: "Terjadi kesalahan saat memproses pembayaran.",
            color: "error",
          });
          payingBillId.value = null;
        },
        onClose: () => {
          console.log('Payment popup closed');
          payingBillId.value = null;
        },
      });
    }
  } catch (e: any) {
    console.error('Create payment error:', e);
    toast.add({
      title: "Error",
      description: e?.data?.message || e?.message || "Gagal membuat transaksi",
      color: "error",
    });
    payingBillId.value = null;
  }
};

const deleteRent = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: "Hapus Rent Bill?",
    message: "Data rent bill ini akan dihapus permanen. Lanjutkan?",
    confirmText: "Hapus",
    confirmColor: "error",
  });
  if (confirmed) {
    try {
      await store.deleteRentBill(id);
      toast.add({
        title: "Deleted",
        description: "Rent bill deleted.",
        color: "success",
      });
    } catch (e: any) {
      toast.add({
        title: "Error",
        description: e?.data?.message || e?.message,
        color: "error",
      });
    }
  }
};

const markUtilityPaid = async (id: string) => {
  try {
    await store.markUtilityBillAsPaid(id);
    toast.add({
      title: "Paid",
      description: "Utility bill marked as paid.",
      color: "success",
    });
  } catch (e: any) {
    toast.add({
      title: "Error",
      description: e?.data?.message || e?.message,
      color: "error",
    });
  }
};

const deleteUtility = async (id: string) => {
  const confirmed = await confirmDialog.value?.confirm({
    title: "Hapus Utility Bill?",
    message: "Data utility bill ini akan dihapus permanen. Lanjutkan?",
    confirmText: "Hapus",
    confirmColor: "error",
  });
  if (confirmed) {
    try {
      await store.deleteUtilityBill(id);
      toast.add({
        title: "Deleted",
        description: "Utility bill deleted.",
        color: "success",
      });
    } catch (e: any) {
      toast.add({
        title: "Error",
        description: e?.data?.message || e?.message,
        color: "error",
      });
    }
  }
};

// Print Actions
const printRent = (bill: RentBill) => {
  const room = rooms.value.find((r) => r.id === bill.roomId);
  const prop = properties.value.find((p) => p.id === room?.propertyId);
  if (!room || !prop) return;
  const tenant = tenants.value.find((t) => t.id === room.tenantId) || null;
  generateRentReceipt(bill, room, prop, tenant);
};

const printUtility = (bill: UtilityBill) => {
  const room = rooms.value.find((r) => r.id === bill.roomId);
  const prop = properties.value.find((p) => p.id === room?.propertyId);
  if (!room || !prop) return;
  const tenant = tenants.value.find((t) => t.id === room.tenantId) || null;
  generateUtilityReceipt(bill, room, prop, tenant);
};

const printCombined = (item: {
  rent?: RentBill;
  util?: UtilityBill;
  roomId: string;
}) => {
  const room = rooms.value.find((r) => r.id === item.roomId);
  const prop = properties.value.find((p) => p.id === room?.propertyId);
  if (!room || !prop) return;
  const tenant = tenants.value.find((t) => t.id === room.tenantId) || null;
  generateCombinedReceipt(
    item.rent || null,
    item.util || null,
    room,
    prop,
    tenant
  );
};

// Send to WhatsApp
const sendingWa = ref(false)
const sendToWhatsApp = async (item: {
  rent?: RentBill;
  util?: UtilityBill;
  roomId: string;
  period: string;
}) => {
  const room = rooms.value.find((r) => r.id === item.roomId);
  const prop = properties.value.find((p) => p.id === room?.propertyId);
  const tenant = tenants.value.find((t) => t.id === room?.tenantId);

  if (!room || !prop) {
    toast.add({
      title: "Error",
      description: "Data kamar tidak ditemukan",
      color: "error",
    });
    return;
  }

  if (!tenant || !tenant.contact) {
    toast.add({
      title: "Error",
      description: "Nomor kontak penghuni tidak tersedia",
      color: "error",
    });
    return;
  }

  // Format phone number for wa.me (remove leading 0, add 62)
  let phoneNumber = tenant.contact.replace(/\D/g, ""); // Remove non-digits
  if (phoneNumber.startsWith("0")) {
    phoneNumber = "62" + phoneNumber.slice(1);
  } else if (!phoneNumber.startsWith("62")) {
    phoneNumber = "62" + phoneNumber;
  }

  // Generate PDF and get URL + Generate public invoice link
  sendingWa.value = true;
  let invoiceUrl = "";
  
  try {
    // Generate public link for combined view (using roomId + period)
    const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
      `/api/bills/public-link/combined`,
      {
        method: 'POST',
        body: { 
          roomId: item.roomId,
          period: item.period 
        },
      }
    );
    invoiceUrl = linkResponse.publicUrl;
  } catch (e: any) {
    toast.add({
      title: "Error",
      description: e?.data?.message || "Gagal generate link",
      color: "error",
    });
    sendingWa.value = false;
    return;
  }

  // Build message
  const totalRent = item.rent ? Number(item.rent.totalAmount) : 0;
  const totalUtil = item.util ? Number(item.util.totalAmount) : 0;
  const grandTotal = totalRent + totalUtil;
  const occupants = room.occupantCount || 1;

  let message = `*TAGIHAN KOST*\n`;
  message += `${prop.name}\n`;
  message += `================================\n\n`;
  message += `Periode: *${item.period}*\n`;
  message += `Kamar: *${room.name}*\n`;
  message += `Penghuni: ${tenant.name}\n`;
  if (occupants > 1) {
    message += `Jumlah Penghuni: ${occupants} orang\n`;
  }
  message += `\n================================\n`;

  if (item.rent) {
    message += `\n*SEWA KAMAR*\n`;
    message += `${item.rent.monthsCovered || 1} bulan x ${formatCurrency(item.rent.roomPrice)}\n`;
    message += `Total: ${formatCurrency(item.rent.totalAmount)}`;
    message += item.rent.isPaid ? " [LUNAS]\n" : "\n";
  }

  if (item.util) {
    message += `\n*UTILITAS*\n\n`;
    
    // Listrik
    const kwhUsage = item.util.meterEnd - item.util.meterStart;
    message += `Listrik:\n`;
    message += `  ${item.util.meterStart} -> ${item.util.meterEnd} = ${kwhUsage} kWh\n`;
    message += `  ${formatCurrency(item.util.usageCost)}\n\n`;
    
    // Air
    const waterPerPerson = Number(item.util.waterFee) / occupants;
    message += `Air:\n`;
    if (occupants > 1) {
      message += `  ${formatCurrency(waterPerPerson)} x ${occupants} orang\n`;
    }
    message += `  ${formatCurrency(item.util.waterFee)}\n`;
    
    // Sampah
    if (Number(item.util.trashFee) > 0) {
      message += `\nSampah:\n`;
      message += `  ${formatCurrency(item.util.trashFee)}\n`;
    }
    
    message += `\nTotal Utilitas: ${formatCurrency(item.util.totalAmount)}`;
    message += item.util.isPaid ? " [LUNAS]\n" : "\n";
  }

  message += `\n================================\n`;
  message += `*TOTAL TAGIHAN: ${formatCurrency(grandTotal)}*\n`;
  
  if (!item.rent?.isPaid || !item.util?.isPaid) {
    message += `Status: *BELUM LUNAS*\n`;
  }
  
  message += `================================\n`;
  
  // Add invoice link
  if (invoiceUrl) {
    message += `\nLihat & Bayar Invoice:\n${invoiceUrl}\n`;
    message += `\n(Klik link di atas untuk melihat detail tagihan dan melakukan pembayaran online)\n`;
  }
  
  message += `\nMohon segera melakukan pembayaran.\nTerima kasih.`;

  sendingWa.value = false;

  // Open WhatsApp
  const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
};

// Helpers
const formatCurrency = (val: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(val));

// Send reminder to WhatsApp
const sendReminder = async (reminder: any) => {
  if (!reminder.tenant?.contact) {
    toast.add({ title: 'Error', description: 'Nomor kontak tidak tersedia', color: 'error' });
    return;
  }

  let phoneNumber = reminder.tenant.contact.replace(/\D/g, '');
  if (phoneNumber.startsWith('0')) {
    phoneNumber = '62' + phoneNumber.slice(1);
  } else if (!phoneNumber.startsWith('62')) {
    phoneNumber = '62' + phoneNumber;
  }

  // Generate public invoice link
  let invoiceUrl = '';
  try {
    // Use combined format if both rent and utility exist for the same period
    if (reminder.unpaidRentBills?.length > 0 && reminder.unpaidUtilityBills?.length > 0) {
      // Check if they have same period
      const rentPeriod = reminder.unpaidRentBills[0].period;
      const utilPeriod = reminder.unpaidUtilityBills[0].period;
      
      if (rentPeriod === utilPeriod) {
        // Generate combined link
        const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
          `/api/bills/public-link/combined`,
          {
            method: 'POST',
            body: { 
              roomId: reminder.room.id,
              period: rentPeriod 
            },
          }
        );
        invoiceUrl = linkResponse.publicUrl;
      } else {
        // Different periods, use first rent bill
        const billId = reminder.unpaidRentBills[0].id;
        const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
          `/api/bills/public-link/${billId}`,
          {
            method: 'POST',
            body: { billType: 'rent' },
          }
        );
        invoiceUrl = linkResponse.publicUrl;
      }
    } else {
      // Only one type of bill
      const billId = reminder.unpaidRentBills?.[0]?.id || reminder.unpaidUtilityBills?.[0]?.id;
      const billType = reminder.unpaidRentBills?.[0] ? 'rent' : 'utility';
      
      if (billId) {
        const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
          `/api/bills/public-link/${billId}`,
          {
            method: 'POST',
            body: { billType },
          }
        );
        invoiceUrl = linkResponse.publicUrl;
      }
    }
  } catch (e) {
    console.error('Failed to generate invoice link:', e);
  }

  let message = `*PENGINGAT TAGIHAN KOST*\n`;
  message += `================================\n\n`;
  message += `Halo *${reminder.tenant.name}*,\n\n`;
  
  // Different message based on reminder type
  if (reminder.reminderType === 'overdue') {
    message += `Tagihan Anda sudah *LEWAT JATUH TEMPO*\n`;
    message += `(${Math.abs(reminder.daysUntilDue)} hari yang lalu)\n\n`;
  } else if (reminder.reminderType === 'due_soon') {
    message += `Tagihan akan jatuh tempo dalam:\n`;
    message += `*${reminder.daysUntilDue} hari* (${reminder.dueDay})\n\n`;
  } else {
    message += `Anda memiliki tagihan yang belum dibayar.\n\n`;
  }
  
  message += `Kos: ${reminder.property?.name || 'Kost'}\n`;
  message += `Kamar: ${reminder.room.name}\n`;
  message += `\n================================\n\n`;
  message += `*RINCIAN TAGIHAN:*\n\n`;
  
  if (reminder.totalUnpaidRent > 0) {
    message += `Sewa Kamar:\n`;
    message += `  ${formatCurrency(reminder.totalUnpaidRent)}\n\n`;
  }
  if (reminder.totalUnpaidUtility > 0) {
    message += `Utilitas (Listrik/Air):\n`;
    message += `  ${formatCurrency(reminder.totalUnpaidUtility)}\n\n`;
  }
  
  message += `================================\n`;
  message += `*TOTAL: ${formatCurrency(reminder.totalUnpaid)}*\n`;
  message += `================================\n\n`;
  
  // Add invoice link
  if (invoiceUrl) {
    message += `Lihat & Bayar Invoice:\n${invoiceUrl}\n\n`;
    message += `(Klik link untuk melihat detail & bayar online)\n\n`;
  }
  
  message += `Mohon segera melakukan pembayaran.\nTerima kasih.`;

  const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
};
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6"
    >
      <div>
        <h1
          class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
        >
          <UIcon
            name="i-heroicons-banknotes"
            class="w-8 h-8 text-primary-500"
          />
          Billing
        </h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Manage rent and utility bills.
        </p>
      </div>
      <UButton
        @click="isGenerating = !isGenerating"
        color="primary"
        icon="i-heroicons-plus"
      >
        Generate Rent Bill
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">
          Total Unpaid
        </div>
        <div class="text-3xl font-bold text-red-500 mt-1">
          {{ formatCurrency(totalUnpaid) }}
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">
          Unpaid Rent
        </div>
        <div class="text-2xl font-bold text-orange-500 mt-1">
          {{ formatCurrency(totalUnpaidRent) }}
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">
          Unpaid Utility
        </div>
        <div class="text-2xl font-bold text-yellow-500 mt-1">
          {{ formatCurrency(totalUnpaidUtility) }}
        </div>
      </div>
    </div>

    <!-- Due Soon Reminders Alert -->
    <div v-if="dueSoonReminders.length > 0" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-bell-alert" class="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <h3 class="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              Pengingat Tagihan
              <UBadge color="warning" variant="solid" size="xs">{{ dueSoonReminders.length }}</UBadge>
            </h3>
            <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {{ dueSoonReminders.length }} penghuni memiliki tagihan belum dibayar.
            </p>
          </div>
        </div>
        <NuxtLink to="/reminders">
          <UButton 
            color="warning" 
            variant="solid"
            icon="i-heroicons-arrow-right"
            trailing
          >
            Lihat Detail
          </UButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 items-center">
      <DatePicker
        v-model="selectedPeriod"
        granularity="month"
        class="w-40"
        placeholder="Semua Periode"
      />
      <USelect
        v-model="selectedPropertyId"
        :items="propertyOptions"
        value-key="value"
        label-key="label"
        class="w-48"
      />
      <USelect
        v-model="selectedRoomId"
        :items="roomOptions"
        value-key="value"
        label-key="label"
        class="w-48"
      />
      <div class="flex gap-1">
        <UButton
          :color="selectedStatus === 'all' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'all'"
          >All</UButton
        >
        <UButton
          :color="selectedStatus === 'unpaid' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'unpaid'"
          >Unpaid</UButton
        >
        <UButton
          :color="selectedStatus === 'paid' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'paid'"
          >Paid</UButton
        >
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
      <UButton
        :color="activeTab === 'rent' ? 'primary' : 'neutral'"
        variant="soft"
        @click="activeTab = 'rent'"
      >
        Rent Bills ({{ filteredRentBills.length }})
      </UButton>
      <UButton
        :color="activeTab === 'utility' ? 'primary' : 'neutral'"
        variant="soft"
        @click="activeTab = 'utility'"
      >
        Utility Bills ({{ filteredUtilityBills.length }})
      </UButton>
      <UButton
        :color="activeTab === 'summary' ? 'primary' : 'neutral'"
        variant="soft"
        @click="activeTab = 'summary'"
      >
        Monthly Summary
      </UButton>
    </div>

    <!-- Rent Bills Table -->
    <UCard v-if="activeTab === 'rent'">
      <div v-if="filteredRentBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead
            class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700"
          >
            <tr>
              <th class="p-3 font-medium">Periode</th>
              <th class="p-3 font-medium">Jumlah Hari</th>
              <th class="p-3 font-medium">Due Date</th>
              <th class="p-3 font-medium">Property</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium">Total</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="bill in filteredRentBills"
              :key="bill.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <td class="p-3 font-medium">
                <div>{{ formatDateRange(bill.periodStartDate, bill.periodEndDate) }}</div>
                <div class="text-xs text-gray-400">{{ bill.monthsCovered || 1 }} bulan</div>
              </td>
              <td class="p-3">
                <div class="font-semibold text-gray-900 dark:text-white">
                  {{ (() => {
                    const [startY, startM, startD] = bill.periodStartDate.split('-').map(Number);
                    const [endY, endM, endD] = bill.periodEndDate.split('-').map(Number);
                    const start = new Date(startY, startM - 1, startD);
                    const end = new Date(endY, endM - 1, endD);
                    return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                  })() }} hari
                </div>
              </td>
              <td class="p-3 text-gray-600">
                {{ new Date(bill.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
              </td>
              <td class="p-3 text-gray-500">
                {{ bill.property?.name || "Unknown" }}
              </td>
              <td class="p-3">
                <div class="font-medium">{{ bill.room?.name || "Unknown" }}</div>
                <div class="text-xs text-gray-500" v-if="bill.tenant?.name">
                  {{ bill.tenant.name }}
                </div>
              </td>
              <td class="p-3 font-bold text-gray-900 dark:text-white">
                {{ formatCurrency(bill.totalAmount) }}
              </td>
              <td class="p-3">
                <UBadge
                  :color="bill.isPaid ? 'success' : 'warning'"
                  variant="subtle"
                  size="xs"
                >
                  {{ bill.isPaid ? "Paid" : "Unpaid" }}
                </UBadge>
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip text="Bayar Online" v-if="!bill.isPaid">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-credit-card"
                      :loading="payingBillId === bill.id"
                      @click="payOnline(bill.id, 'rent')"
                    />
                  </UTooltip>
                  <UTooltip text="Mark as Paid" v-if="!bill.isPaid">
                    <UButton
                      size="xs"
                      color="success"
                      variant="soft"
                      icon="i-heroicons-check"
                      @click="markRentPaid(bill.id)"
                    />
                  </UTooltip>
                  <UTooltip text="Print">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-heroicons-printer"
                      @click="printRent(bill)"
                    />
                  </UTooltip>
                  <UTooltip text="Delete">
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      @click="deleteRent(bill.id)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-gray-500">No rent bills found.</p>
      </div>
    </UCard>

    <!-- Utility Bills Table -->
    <UCard v-if="activeTab === 'utility'">
      <div v-if="filteredUtilityBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead
            class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700"
          >
            <tr>
              <th class="p-3 font-medium">Period</th>
              <th class="p-3 font-medium">Property</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium">Usage</th>
              <th class="p-3 font-medium">Total</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="bill in filteredUtilityBills"
              :key="bill.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <td class="p-3 font-medium">{{ bill.period }}</td>
              <td class="p-3 text-gray-500">
                {{ bill.property?.name || "Unknown" }}
              </td>
              <td class="p-3">
                <div class="font-medium">{{ bill.room?.name || "Unknown" }}</div>
                <div class="text-xs text-gray-500" v-if="bill.tenant?.name">
                  {{ bill.tenant.name }}
                </div>
              </td>
              <td class="p-3">
                <div>{{ bill.meterEnd - bill.meterStart }} kWh</div>
                <div class="text-xs text-gray-400 font-mono">
                  {{ bill.meterStart }} → {{ bill.meterEnd }}
                </div>
              </td>
              <td class="p-3 font-bold text-gray-900 dark:text-white">
                {{ formatCurrency(bill.totalAmount) }}
              </td>
              <td class="p-3">
                <UBadge
                  :color="bill.isPaid ? 'success' : 'warning'"
                  variant="subtle"
                  size="xs"
                >
                  {{ bill.isPaid ? "Paid" : "Unpaid" }}
                </UBadge>
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip text="Bayar Online" v-if="!bill.isPaid">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-credit-card"
                      :loading="payingBillId === bill.id"
                      @click="payOnline(bill.id, 'utility')"
                    />
                  </UTooltip>
                  <UTooltip text="Mark as Paid" v-if="!bill.isPaid">
                    <UButton
                      size="xs"
                      color="success"
                      variant="soft"
                      icon="i-heroicons-check"
                      @click="markUtilityPaid(bill.id)"
                    />
                  </UTooltip>
                  <UTooltip text="Print">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-heroicons-printer"
                      @click="printUtility(bill)"
                    />
                  </UTooltip>
                  <UTooltip text="Delete">
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-heroicons-trash"
                      @click="deleteUtility(bill.id)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-gray-500">No utility bills found.</p>
        <p class="text-gray-400 text-sm mt-1">
          Utility bills are auto-generated when you add meter readings.
        </p>
      </div>
    </UCard>

    <!-- Combined Statements Table -->
    <UCard v-if="activeTab === 'summary'">
      <div v-if="combinedBills.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead
            class="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700"
          >
            <tr>
              <th class="p-3 font-medium">Period</th>
              <th class="p-3 font-medium">Room</th>
              <th class="p-3 font-medium text-right">Rent</th>
              <th class="p-3 font-medium text-right">Utility</th>
              <th class="p-3 font-medium text-right">Total</th>
              <th class="p-3 font-medium text-center">Status</th>
              <th class="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="item in combinedBills"
              :key="`${item.roomId}-${item.period}`"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <td class="p-3 font-medium">{{ item.period }}</td>
              <td class="p-3">
                <div class="font-medium">
                  {{
                    item.rent?.room?.name || item.util?.room?.name || "Unknown"
                  }}
                </div>
                <div class="text-xs text-gray-500">
                  {{
                    item.rent?.property?.name ||
                    item.util?.property?.name ||
                    "Unknown"
                  }}
                </div>
                <div class="text-xs text-gray-500" v-if="item.rent?.tenant?.name || item.util?.tenant?.name">
                  {{ item.rent?.tenant?.name || item.util?.tenant?.name }}
                </div>
              </td>
              <td class="p-3 text-right">
                <div v-if="item.rent">
                  {{ formatCurrency(item.rent.totalAmount) }}
                  <UIcon
                    v-if="item.rent.isPaid"
                    name="i-heroicons-check-circle"
                    class="w-4 h-4 text-success-500 inline ml-1"
                  />
                  <UIcon
                    v-else
                    name="i-heroicons-clock"
                    class="w-4 h-4 text-warning-500 inline ml-1"
                  />
                </div>
                <div v-else class="text-gray-400">-</div>
              </td>
              <td class="p-3 text-right">
                <div v-if="item.util">
                  {{ formatCurrency(item.util.totalAmount) }}
                  <UIcon
                    v-if="item.util.isPaid"
                    name="i-heroicons-check-circle"
                    class="w-4 h-4 text-success-500 inline ml-1"
                  />
                  <UIcon
                    v-else
                    name="i-heroicons-clock"
                    class="w-4 h-4 text-warning-500 inline ml-1"
                  />
                </div>
                <div v-else class="text-gray-400">-</div>
              </td>
              <td class="p-3 text-right font-bold">
                {{
                  formatCurrency(
                    Number(item.rent?.totalAmount || 0) +
                      Number(item.util?.totalAmount || 0)
                  )
                }}
              </td>
              <td class="p-3 text-center">
                <UBadge
                  :color="
                    item.rent?.isPaid !== false && item.util?.isPaid !== false
                      ? 'success'
                      : item.rent?.isPaid || item.util?.isPaid
                        ? 'warning'
                        : 'error'
                  "
                  variant="subtle"
                  size="xs"
                >
                  {{
                    item.rent?.isPaid !== false && item.util?.isPaid !== false
                      ? "PAID"
                      : item.rent?.isPaid || item.util?.isPaid
                        ? "PARTIAL"
                        : "UNPAID"
                  }}
                </UBadge>
              </td>
              <td class="p-3 text-right">
                <div class="flex justify-end gap-1">
                  <UTooltip text="Kirim ke WhatsApp">
                    <UButton
                      size="sm"
                      color="success"
                      variant="soft"
                      icon="i-heroicons-chat-bubble-left-ellipsis"
                      @click="sendToWhatsApp(item)"
                      >WA</UButton
                    >
                  </UTooltip>
                  <UTooltip text="Print Statement">
                    <UButton
                      size="sm"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-printer"
                      @click="printCombined(item)"
                      >Print</UButton
                    >
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16">
        <p class="text-gray-500">No data found for summary.</p>
      </div>
    </UCard>
  </div>

  <!-- Generate Rent Bill Modal -->
  <UModal :open="isGenerating" @close="isGenerating = false">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-lg">Generate Rent Bill</h3>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-heroicons-x-mark"
              @click="isGenerating = false"
            />
          </div>
        </template>

        <div class="space-y-4 p-1">
          <UFormField label="Property">
            <USelect
              v-model="genPropertyId"
              :items="propertyOptions"
              value-key="value"
              label-key="label"
              placeholder="Semua properti..."
              class="w-full"
              @update:model-value="genRoomId = ''"
            />
          </UFormField>

          <UFormField label="Room" required>
            <USelect
              v-model="genRoomId"
              :items="genRoomOptions"
              value-key="value"
              label-key="label"
              placeholder="Pilih kamar..."
              class="w-full"
              :disabled="genRoomOptions.length === 0"
            />
            <p v-if="genRoomOptions.length === 0" class="text-xs text-amber-600 mt-1">
              {{ genPropertyId ? 'Tidak ada kamar terisi di properti ini' : 'Pilih properti terlebih dahulu' }}
            </p>
          </UFormField>

          <UFormField label="Tanggal Mulai Periode" required>
            <div class="flex gap-2 items-center">
              <DatePicker
                v-model="genPeriodStartDate"
                granularity="day"
                class="flex-1"
                :is-date-unavailable="isDateUnavailable"
              />
              <UButton
                v-if="genRoom?.moveInDate"
                variant="soft"
                color="primary"
                size="sm"
                @click="setNextBillingCycle"
                icon="i-heroicons-arrow-path"
              >
                Auto
              </UButton>
            </div>
            <!-- Show moveInDate info -->
            <div v-if="genRoom?.moveInDate" class="mt-2">
              <p class="text-xs text-blue-600 dark:text-blue-400">
                <UIcon name="i-heroicons-calendar" class="w-3 h-3 inline" />
                Tanggal masuk: {{ new Date(genRoom.moveInDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) }}
              </p>
            </div>
            <!-- Show date range preview -->
            <div v-if="genPeriodStartDate && genPeriodEndDate" class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p class="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                <span>Periode: <strong>{{ formatDateRange(genPeriodStartDate, genPeriodEndDate) }}</strong></span>
              </p>
              <p class="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Due Date: {{ new Date(genDueDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) }}
              </p>
            </div>
            <!-- Show existing bills info -->
            <div v-if="genRoomId && existingRentBillRanges.length > 0" class="mt-2">
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Periode terisi (disabled): 
                <span class="font-mono font-semibold">{{ existingRentBillRanges.map(r => r.formatted).join('; ') }}</span>
              </p>
            </div>
            <!-- Show conflict warning -->
            <div v-if="dateRangeConflict" class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p class="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                <span>Konflik: Periode {{ dateRangeConflict }} sudah memiliki rent bill!</span>
              </p>
            </div>
          </UFormField>

          <UFormField label="Jumlah Bulan">
            <UInput
              type="number"
              v-model.number="genMonthsCovered"
              min="1"
              max="12"
            />
          </UFormField>

          <!-- Summary Card -->
          <div
            v-if="genRoom"
            class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg border border-primary-200 dark:border-primary-800"
          >
            <div class="flex items-center gap-2 mb-3">
              <UIcon
                name="i-heroicons-calculator"
                class="w-5 h-5 text-primary-500"
              />
              <span class="font-semibold text-primary-700 dark:text-primary-300"
                >Ringkasan Tagihan</span
              >
            </div>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400"
                  >Harga per Bulan:</span
                >
                <span class="font-medium">{{
                  formatCurrency(genRoom.price)
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Durasi:</span>
                <span class="font-medium">{{ genMonthsCovered }} Bulan</span>
              </div>
              <div
                class="border-t border-primary-200 dark:border-primary-700 pt-2 mt-2"
              >
                <div class="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span class="text-primary-600 dark:text-primary-400">{{
                    formatCurrency(Number(genRoom.price) * genMonthsCovered)
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              variant="outline"
              color="neutral"
              @click="isGenerating = false"
              >Batal</UButton
            >
            <UButton
              @click="generateRentBill"
              color="primary"
              :disabled="!genRoomId || !!dateRangeConflict"
              :loading="rentBillsLoading"
              icon="i-heroicons-plus"
            >
              Buat Tagihan
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Confirm Dialog -->
  <ConfirmDialog ref="confirmDialog" />
</template>
