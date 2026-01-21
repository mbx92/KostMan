<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getPaginationRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'
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

// Payment Modal State
const paymentModalOpen = ref(false);
const paymentBillId = ref<string | null>(null);
const paymentBillType = ref<'rent' | 'utility'>('rent');
const paymentBillData = ref<RentBill | UtilityBill | null>(null);

// Payment History State
const paymentHistoryOpen = ref(false);
const paymentHistoryBillId = ref<string | null>(null);
const paymentHistoryBillType = ref<'rent' | 'utility'>('rent');

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
  { label: "Semua Properti", value: "all" },
  ...properties.value.map((p) => ({ label: p.name, value: p.id })),
]);

const roomOptions = computed(() => {
  const baseRooms =
    selectedPropertyId.value !== "all"
      ? rooms.value.filter((r) => r.propertyId === selectedPropertyId.value)
      : rooms.value;
  return [
    { label: "Semua Kamar", value: "all" },
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

// Client-side filtering for mobile view
const mobileFilteredRentBills = computed(() => {
  if (!rentFilter.value) return filteredRentBills.value;
  const search = rentFilter.value.toLowerCase();
  return filteredRentBills.value.filter(bill => {
    const roomName = bill.room?.name?.toLowerCase() || '';
    const tenantName = bill.tenant?.name?.toLowerCase() || bill.room?.tenantName?.toLowerCase() || '';
    const propertyName = bill.property?.name?.toLowerCase() || '';
    return roomName.includes(search) || tenantName.includes(search) || propertyName.includes(search);
  });
});

const mobileFilteredUtilityBills = computed(() => {
  if (!utilityFilter.value) return filteredUtilityBills.value;
  const search = utilityFilter.value.toLowerCase();
  return filteredUtilityBills.value.filter(bill => {
    const roomName = bill.room?.name?.toLowerCase() || '';
    const tenantName = bill.tenant?.name?.toLowerCase() || bill.room?.tenantName?.toLowerCase() || '';
    const propertyName = bill.property?.name?.toLowerCase() || '';
    return roomName.includes(search) || tenantName.includes(search) || propertyName.includes(search);
  });
});

const mobileFilteredCombinedBills = computed(() => {
  if (!summaryFilter.value) return combinedBills.value;
  const search = summaryFilter.value.toLowerCase();
  return combinedBills.value.filter(item => {
    const roomName = item.rent?.room?.name?.toLowerCase() || item.util?.room?.name?.toLowerCase() || '';
    const tenantName = item.rent?.tenant?.name?.toLowerCase() || item.util?.tenant?.name?.toLowerCase() || 
                       item.rent?.room?.tenantName?.toLowerCase() || item.util?.room?.tenantName?.toLowerCase() || '';
    const propertyName = item.rent?.property?.name?.toLowerCase() || item.util?.property?.name?.toLowerCase() || '';
    return roomName.includes(search) || tenantName.includes(search) || propertyName.includes(search);
  });
});

// Mobile Pagination
const mobileLimits = reactive({
  rent: 5,
  utility: 5,
  summary: 5
});

const mobileLoading = reactive({
  rent: false,
  utility: false,
  summary: false
});

const loadMoreMobile = async (section: 'rent' | 'utility' | 'summary') => {
  mobileLoading[section] = true;
  await new Promise(resolve => setTimeout(resolve, 300));
  mobileLimits[section] += 5;
  mobileLoading[section] = false;
};

const resetMobileLimit = (section: 'rent' | 'utility' | 'summary') => {
  mobileLimits[section] = 5;
};

// Desktop Table Configuration
const rentTable = useTemplateRef('rentTable');
const utilityTable = useTemplateRef('utilityTable');
const summaryTable = useTemplateRef('summaryTable');

// Table Pagination
const rentPagination = ref({ pageIndex: 0, pageSize: 10 });
const utilityPagination = ref({ pageIndex: 0, pageSize: 10 });
const summaryPagination = ref({ pageIndex: 0, pageSize: 10 });

// Table Global Filters
const rentFilter = ref('');
const utilityFilter = ref('');
const summaryFilter = ref('');

// Rent Bills Column Definitions
const rentColumns: TableColumn<RentBill>[] = [
  {
    accessorKey: 'periodStartDate',
    header: 'Periode',
  },
  {
    accessorKey: 'dueDate',
    header: 'Jatuh Tempo',
  },
  {
    accessorFn: (row) => row.property?.name || 'Unknown',
    id: 'property',
    header: 'Properti',
  },
  {
    accessorFn: (row) => row.room?.name || 'Unknown',
    id: 'room',
    header: 'Kamar',
  },
  {
    accessorFn: (row) => row.tenant?.name || row.room?.tenantName || '',
    id: 'tenant',
    header: 'Penghuni',
  },
  {
    accessorKey: 'totalAmount',
    header: 'Total',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
  {
    accessorFn: (row) => row.isPaid ? 'Paid' : 'Unpaid',
    id: 'status',
    header: 'Status',
  },
  {
    id: 'actions',
    header: 'Aksi',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  }
];

// Utility Bills Column Definitions
const utilityColumns: TableColumn<UtilityBill>[] = [
  {
    accessorKey: 'period',
    header: 'Period',
  },
  {
    accessorFn: (row) => row.property?.name || 'Unknown',
    id: 'property',
    header: 'Properti',
  },
  {
    accessorFn: (row) => row.room?.name || 'Unknown',
    id: 'room',
    header: 'Kamar',
  },
  {
    accessorFn: (row) => row.tenant?.name || row.room?.tenantName || '',
    id: 'tenant',
    header: 'Penghuni',
  },
  {
    accessorFn: (row) => (row.meterEnd || 0) - (row.meterStart || 0),
    id: 'usage',
    header: 'Pemakaian',
  },
  {
    accessorKey: 'totalAmount',
    header: 'Total',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
  {
    accessorFn: (row) => row.isPaid ? 'Paid' : 'Unpaid',
    id: 'status',
    header: 'Status',
  },
  {
    id: 'actions',
    header: 'Aksi',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  }
];

// Summary (Combined Bills) Column Definitions
interface CombinedBillItem {
  period: string;
  roomId: string;
  rent?: RentBill;
  util?: UtilityBill;
}

const summaryColumns: TableColumn<CombinedBillItem>[] = [
  {
    accessorKey: 'period',
    header: 'Period',
  },
  {
    accessorFn: (row) => row.rent?.room?.name || row.util?.room?.name || 'Unknown',
    id: 'room',
    header: 'Kamar',
  },
  {
    accessorFn: (row) => row.rent?.tenant?.name || row.util?.tenant?.name || row.rent?.room?.tenantName || row.util?.room?.tenantName || '',
    id: 'tenant',
    header: 'Penghuni',
  },
  {
    accessorFn: (row) => row.rent?.totalAmount || 0,
    id: 'rent',
    header: 'Sewa',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
  {
    accessorFn: (row) => row.util?.totalAmount || 0,
    id: 'utility',
    header: 'Utilitas',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
  {
    accessorFn: (row) => Number(row.rent?.totalAmount || 0) + Number(row.util?.totalAmount || 0),
    id: 'total',
    header: 'Total',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
  {
    accessorFn: (row) => {
      const rentPaid = row.rent?.isPaid !== false;
      const utilPaid = row.util?.isPaid !== false;
      if (rentPaid && utilPaid) return 'PAID';
      if (row.rent?.isPaid || row.util?.isPaid) return 'PARTIAL';
      return 'UNPAID';
    },
    id: 'status',
    header: 'Status',
  },
  {
    id: 'actions',
    header: 'Aksi',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  }
];

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
    .map((r) => {
      const tenant = tenants.value.find((t) => t.id === r.tenantId);
      const tenantName = tenant?.name || r.tenantName || '';
      
      // Show room name with tenant info if available, otherwise just room name
      let label = r.name;
      if (tenantName) {
        label = `${r.name} - ${tenantName}`;
      } else if (r.status === 'available') {
        label = `${r.name} (Kosong)`;
      } else if (r.status === 'maintenance') {
        label = `${r.name} (Maintenance)`;
      }
      
      return { 
        label,
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

// Refresh data when generate modal is opened
watch(isGenerating, async (newVal) => {
  if (newVal) {
    // Refresh rooms, properties, and tenants when modal opens
    await Promise.all([
      store.fetchRooms(),
      store.fetchProperties(),
      store.fetchTenants(),
    ]);
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
  
  // Validate that room has a tenant
  if (!genRoom.value.tenantId) {
    toast.add({
      title: "Error",
      description: "Kamar ini belum memiliki penghuni. Silakan assign penghuni terlebih dahulu di halaman Kamar.",
      color: "error",
    });
    return;
  }
  
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
      title: "Berhasil",
      description: "Rent bill berhasil dibuat.",
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
      title: "Lunas",
      description: "Rent bill ditandai lunas.",
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
        title: "Dihapus",
        description: "Rent bill telah dihapus.",
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
      title: "Lunas",
      description: "Utility bill ditandai lunas.",
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

// Payment Handlers
const openPaymentModal = (billId: string, billType: 'rent' | 'utility') => {
  const bill = billType === 'rent' 
    ? rentBills.value.find(b => b.id === billId)
    : utilityBills.value.find(b => b.id === billId);
  
  if (!bill) {
    toast.add({
      title: "Error",
      description: "Tagihan tidak ditemukan",
      color: "error",
    });
    return;
  }
  
  paymentBillId.value = billId;
  paymentBillType.value = billType;
  paymentBillData.value = bill;
  paymentModalOpen.value = true;
};

const openPaymentHistory = (billId: string, billType: 'rent' | 'utility') => {
  paymentHistoryBillId.value = billId;
  paymentHistoryBillType.value = billType;
  paymentHistoryOpen.value = true;
};

const handlePaymentAdded = async () => {
  // Refresh bills data
  await store.fetchRentBills();
  await store.fetchUtilityBills();
  paymentModalOpen.value = false;
  
  toast.add({
    title: "Pembayaran Dicatat",
    description: "Pembayaran berhasil dicatat",
    color: "success",
  });
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
        title: "Dihapus",
        description: "Utility bill telah dihapus.",
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
  try {
    const room = rooms.value.find((r) => r.id === bill.roomId);
    const prop = properties.value.find((p) => p.id === room?.propertyId);
    
    if (!room || !prop) {
      console.error('Print failed: Room or property not found', { billId: bill.id, roomId: bill.roomId });
      toast.add({
        title: 'Error',
        description: 'Data kamar atau properti tidak ditemukan',
        color: 'error',
      });
      return;
    }
    
    const tenant = tenants.value.find((t) => t.id === room.tenantId) || null;
    generateRentReceipt(bill, room, prop, tenant);
  } catch (error: any) {
    console.error('Print rent error:', error);
    toast.add({
      title: 'Error',
      description: error?.message || 'Gagal mencetak tagihan',
      color: 'error',
    });
  }
};

const printUtility = (bill: UtilityBill) => {
  try {
    const room = rooms.value.find((r) => r.id === bill.roomId);
    const prop = properties.value.find((p) => p.id === room?.propertyId);
    
    if (!room || !prop) {
      console.error('Print failed: Room or property not found', { billId: bill.id, roomId: bill.roomId });
      toast.add({
        title: 'Error',
        description: 'Data kamar atau properti tidak ditemukan',
        color: 'error',
      });
      return;
    }
    
    const tenant = tenants.value.find((t) => t.id === room.tenantId) || null;
    generateUtilityReceipt(bill, room, prop, tenant);
  } catch (error: any) {
    console.error('Print utility error:', error);
    toast.add({
      title: 'Error',
      description: error?.message || 'Gagal mencetak tagihan',
      color: 'error',
    });
  }
};

const printCombined = (item: {
  rent?: RentBill;
  util?: UtilityBill;
  roomId: string;
}) => {
  try {
    // Use data from bills if available (already joined)
    const room = item.rent?.room || item.util?.room || rooms.value.find((r) => r.id === item.roomId);
    const prop = item.rent?.property || item.util?.property || properties.value.find((p) => p.id === room?.propertyId);
    
    if (!room || !prop) {
      console.error('Print failed: Room or property not found', { roomId: item.roomId });
      toast.add({
        title: 'Error',
        description: 'Data kamar atau properti tidak ditemukan',
        color: 'error',
      });
      return;
    }
    
    const tenant = tenants.value.find((t) => t.id === room.tenantId) || null;
    generateCombinedReceipt(
      item.rent || null,
      item.util || null,
      room,
      prop,
      tenant
    );
  } catch (error: any) {
    console.error('Print combined error:', error);
    toast.add({
      title: 'Error',
      description: error?.message || 'Gagal mencetak laporan',
      color: 'error',
    });
  }
};

// Send to WhatsApp
const sendingWa = ref(false)
const { buildMessage, getDefaultTemplate, openWhatsApp } = useWhatsAppTemplate();

const sendToWhatsApp = async (item: {
  rent?: RentBill;
  util?: UtilityBill;
  roomId: string;
  period: string;
}) => {
  // Get room and property from bill data (already joined from API)
  const room = item.rent?.room || item.util?.room;
  const prop = item.rent?.property || item.util?.property;
  
  // Fallback: search in local arrays if not in bill data
  const roomFallback = room || rooms.value.find((r) => r.id === item.roomId);
  const propFallback = prop || properties.value.find((p) => p.id === roomFallback?.propertyId);
  const tenant = tenants.value.find((t) => t.id === roomFallback?.tenantId);

  if (!roomFallback || !propFallback) {
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

  // Generate public invoice link
  sendingWa.value = true;
  let invoiceUrl = "";
  
  try {
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

  // Get template from database
  const template = await getDefaultTemplate('billing');

  // Build billing data for template
  const totalRent = item.rent ? Number(item.rent.totalAmount) : 0;
  const totalUtil = item.util ? Number(item.util.totalAmount) : 0;
  const grandTotal = totalRent + totalUtil;

  const billingData = {
    tenantName: tenant.name,
    propertyName: propFallback.name,
    roomName: roomFallback.name,
    period: item.period,
    occupantCount: roomFallback.occupantCount || 1,
    
    // Rent details
    rentAmount: totalRent,
    monthsCovered: item.rent?.monthsCovered || 1,
    roomPrice: item.rent?.roomPrice || 0,
    isRentPaid: item.rent?.isPaid || false,
    
    // Utility details
    meterStart: item.util?.meterStart,
    meterEnd: item.util?.meterEnd,
    usageCost: item.util?.usageCost || 0,
    waterFee: item.util?.waterFee || 0,
    trashFee: item.util?.trashFee || 0,
    utilityTotal: totalUtil,
    isUtilityPaid: item.util?.isPaid || false,
    
    // Grand total
    grandTotal: grandTotal,
    
    // Invoice link
    invoiceUrl: invoiceUrl
  };

  // Build message using template
  const message = buildMessage(template.message, billingData);

  sendingWa.value = false;

  // Open WhatsApp
  openWhatsApp(tenant.contact, message);
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
          Tagihan
        </h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Kelola tagihan sewa dan utilitas.
        </p>
      </div>
      <UButton
        @click="isGenerating = !isGenerating"
        color="primary"
        icon="i-heroicons-plus"
      >
        Buat Tagihan Sewa
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">
          Total Belum Lunas
        </div>
        <div class="text-3xl font-bold text-red-500 mt-1">
          {{ formatCurrency(totalUnpaid) }}
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">
          Sewa Belum Lunas
        </div>
        <div class="text-2xl font-bold text-orange-500 mt-1">
          {{ formatCurrency(totalUnpaidRent) }}
        </div>
      </div>
      <div
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <div class="text-sm text-gray-500 uppercase tracking-wide font-medium">
          Utilitas Belum Lunas
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
          >Semua</UButton
        >
        <UButton
          :color="selectedStatus === 'unpaid' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'unpaid'"
          >Belum Lunas</UButton
        >
        <UButton
          :color="selectedStatus === 'paid' ? 'primary' : 'neutral'"
          variant="soft"
          @click="selectedStatus = 'paid'"
          >Lunas</UButton
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
        Tagihan Sewa ({{ filteredRentBills.length }})
      </UButton>
      <UButton
        :color="activeTab === 'utility' ? 'primary' : 'neutral'"
        variant="soft"
        @click="activeTab = 'utility'"
      >
        Tagihan Utilitas ({{ filteredUtilityBills.length }})
      </UButton>
      <UButton
        :color="activeTab === 'summary' ? 'primary' : 'neutral'"
        variant="soft"
        @click="activeTab = 'summary'"
      >
        Ringkasan Bulanan
      </UButton>
    </div>

    <!-- Rent Bills Table -->
    <UCard v-if="activeTab === 'rent'">
      <!-- Mobile View: Accordion Cards -->
      <div v-if="filteredRentBills.length > 0" class="lg:hidden p-4 space-y-3">
        <!-- Search Filter Mobile -->
        <div class="mb-4">
          <UInput v-model="rentFilter" placeholder="Cari kamar, nama penghuni..." icon="i-heroicons-magnifying-glass" />
        </div>
        
        <BillingRentBillCard
          v-for="bill in mobileFilteredRentBills.slice(0, mobileLimits.rent)"
          :key="bill.id"
          :bill="bill"
          :format-currency="formatCurrency"
          :format-date-range="formatDateRange"
          @mark-paid="markRentPaid"
          @pay-online="(id) => payOnline(id, 'rent')"
          @print="printRent"
          @delete="deleteRent"
          @record-payment="(id) => openPaymentModal(id, 'rent')"
          @view-payments="(id) => openPaymentHistory(id, 'rent')"
        />
        
        <!-- Loading Skeleton -->
        <div v-if="mobileLoading.rent" class="space-y-3">
          <div class="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
            <div class="flex items-start gap-3">
              <div class="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="flex-1 space-y-3">
                <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mt-3"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination Buttons -->
        <div v-if="mobileFilteredRentBills.length > 5 && !mobileLoading.rent" class="flex justify-center gap-4 pt-2">
          <span 
            v-if="mobileLimits.rent < mobileFilteredRentBills.length"
            class="text-sm text-primary-600 dark:text-primary-400 font-medium cursor-pointer hover:underline"
            @click="loadMoreMobile('rent')"
          >
            Lebih Banyak
          </span>
          <span 
            v-if="mobileLimits.rent > 5"
            class="text-sm text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:underline"
            @click="resetMobileLimit('rent')"
          >
            Tampilkan Lebih Sedikit
          </span>
        </div>
      </div>
      
      <!-- Desktop View: UTable with Pagination -->
      <div v-if="filteredRentBills.length > 0" class="hidden lg:block">
        <!-- Search Filter -->
        <div class="flex px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <UInput v-model="rentFilter" class="max-w-sm" placeholder="Cari kamar, nama penghuni..." icon="i-heroicons-magnifying-glass" />
        </div>
        
        <UTable
          ref="rentTable"
          v-model:pagination="rentPagination"
          v-model:global-filter="rentFilter"
          :data="filteredRentBills"
          :columns="rentColumns"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        >
          <!-- Period Cell -->
          <template #periodStartDate-cell="{ row }">
            <div class="font-medium">{{ formatDateRange(row.original.periodStartDate, row.original.periodEndDate) }}</div>
            <div class="text-xs text-gray-400">{{ row.original.monthsCovered || 1 }} bulan</div>
          </template>
          
          <!-- Due Date Cell -->
          <template #dueDate-cell="{ row }">
            <span class="text-gray-600">
              {{ new Date(row.original.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
            </span>
          </template>
          
          <!-- Room Cell -->
          <template #room-cell="{ row }">
            <div class="font-medium">{{ row.original.room?.name || 'Unknown' }}</div>
            <div v-if="row.original.tenant?.name" class="text-xs text-gray-500">{{ row.original.tenant.name }}</div>
          </template>
          
          <!-- Total Cell -->
          <template #totalAmount-cell="{ row }">
            <span class="font-bold text-gray-900 dark:text-white">{{ formatCurrency(row.original.totalAmount) }}</span>
          </template>
          
          <!-- Status Cell -->
          <template #status-cell="{ row }">
            <UBadge :color="row.original.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
              {{ row.original.isPaid ? 'Paid' : 'Unpaid' }}
            </UBadge>
          </template>
          
          <!-- Actions Cell -->
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UTooltip text="Catat Pembayaran" v-if="!row.original.isPaid">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-banknotes"
                  @click="openPaymentModal(row.original.id, 'rent')"
                />
              </UTooltip>
              <UTooltip text="Tandai Lunas" v-if="!row.original.isPaid">
                <UButton
                  size="xs"
                  color="success"
                  variant="soft"
                  icon="i-heroicons-check"
                  @click="markRentPaid(row.original.id)"
                />
              </UTooltip>
              <UTooltip text="Cetak">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-printer"
                  @click="printRent(row.original)"
                />
              </UTooltip>
              <UTooltip text="Hapus">
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  @click="deleteRent(row.original.id)"
                />
              </UTooltip>
            </div>
          </template>
        </UTable>
        
        <!-- Pagination -->
        <div class="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4 px-4 pb-4">
          <span class="text-sm text-gray-500">
            Menampilkan {{ (rentPagination.pageIndex * rentPagination.pageSize) + 1 }} - 
            {{ Math.min((rentPagination.pageIndex + 1) * rentPagination.pageSize, rentTable?.tableApi?.getFilteredRowModel().rows.length || 0) }} 
            dari {{ rentTable?.tableApi?.getFilteredRowModel().rows.length || 0 }}
          </span>
          <UPagination
            :page="(rentTable?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="rentTable?.tableApi?.getState().pagination.pageSize"
            :total="rentTable?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p) => rentTable?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
      <div v-if="filteredRentBills.length === 0" class="text-center py-16">
        <p class="text-gray-500">Tidak ada tagihan sewa ditemukan.</p>
      </div>
    </UCard>

    <!-- Utility Bills Table -->
    <UCard v-if="activeTab === 'utility'">
      <!-- Mobile View: Accordion Cards -->
      <div v-if="filteredUtilityBills.length > 0" class="lg:hidden p-4 space-y-3">
        <!-- Search Filter Mobile -->
        <div class="mb-4">
          <UInput v-model="utilityFilter" placeholder="Cari kamar, nama penghuni..." icon="i-heroicons-magnifying-glass" />
        </div>
        
        <BillingUtilityBillCard
          v-for="bill in mobileFilteredUtilityBills.slice(0, mobileLimits.utility)"
          :key="bill.id"
          :bill="bill"
          :format-currency="formatCurrency"
          @mark-paid="markUtilityPaid"
          @pay-online="(id) => payOnline(id, 'utility')"
          @print="printUtility"
          @delete="deleteUtility"
          @record-payment="(id) => openPaymentModal(id, 'utility')"
          @view-payments="(id) => openPaymentHistory(id, 'utility')"
        />
        
        <!-- Loading Skeleton -->
        <div v-if="mobileLoading.utility" class="space-y-3">
          <div class="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
            <div class="flex items-start gap-3">
              <div class="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="flex-1 space-y-3">
                <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mt-3"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination Buttons -->
        <div v-if="mobileFilteredUtilityBills.length > 5 && !mobileLoading.utility" class="flex justify-center gap-4 pt-2">
          <span 
            v-if="mobileLimits.utility < mobileFilteredUtilityBills.length"
            class="text-sm text-primary-600 dark:text-primary-400 font-medium cursor-pointer hover:underline"
            @click="loadMoreMobile('utility')"
          >
            Lebih Banyak
          </span>
          <span 
            v-if="mobileLimits.utility > 5"
            class="text-sm text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:underline"
            @click="resetMobileLimit('utility')"
          >
            Tampilkan Lebih Sedikit
          </span>
        </div>
      </div>
      
      <!-- Desktop View: UTable with Pagination -->
      <div v-if="filteredUtilityBills.length > 0" class="hidden lg:block">
        <!-- Search Filter -->
        <div class="flex px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <UInput v-model="utilityFilter" class="max-w-sm" placeholder="Cari kamar, nama penghuni..." icon="i-heroicons-magnifying-glass" />
        </div>
        
        <UTable
          ref="utilityTable"
          v-model:pagination="utilityPagination"
          v-model:global-filter="utilityFilter"
          :data="filteredUtilityBills"
          :columns="utilityColumns"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        >
          <!-- Period Cell -->
          <template #period-cell="{ row }">
            <span class="font-medium">{{ row.original.period }}</span>
          </template>
          
          <!-- Room Cell -->
          <template #room-cell="{ row }">
            <div class="font-medium">{{ row.original.room?.name || 'Unknown' }}</div>
            <div v-if="row.original.tenant?.name" class="text-xs text-gray-500">{{ row.original.tenant.name }}</div>
          </template>
          
          <!-- Usage Cell -->
          <template #usage-cell="{ row }">
            <div>{{ (row.original.meterEnd || 0) - (row.original.meterStart || 0) }} kWh</div>
            <div class="text-xs text-gray-400 font-mono">{{ row.original.meterStart }} → {{ row.original.meterEnd }}</div>
          </template>
          
          <!-- Total Cell -->
          <template #totalAmount-cell="{ row }">
            <span class="font-bold text-gray-900 dark:text-white">{{ formatCurrency(row.original.totalAmount) }}</span>
          </template>
          
          <!-- Status Cell -->
          <template #status-cell="{ row }">
            <UBadge :color="row.original.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
              {{ row.original.isPaid ? 'Paid' : 'Unpaid' }}
            </UBadge>
          </template>
          
          <!-- Actions Cell -->
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UTooltip text="Catat Pembayaran" v-if="!row.original.isPaid">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-banknotes"
                  @click="openPaymentModal(row.original.id, 'utility')"
                />
              </UTooltip>
              <UTooltip text="Tandai Lunas" v-if="!row.original.isPaid">
                <UButton
                  size="xs"
                  color="success"
                  variant="soft"
                  icon="i-heroicons-check"
                  @click="markUtilityPaid(row.original.id)"
                />
              </UTooltip>
              <UTooltip text="Cetak">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-printer"
                  @click="printUtility(row.original)"
                />
              </UTooltip>
              <UTooltip text="Hapus">
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  @click="deleteUtility(row.original.id)"
                />
              </UTooltip>
            </div>
          </template>
        </UTable>
        
        <!-- Pagination -->
        <div class="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4 px-4 pb-4">
          <span class="text-sm text-gray-500">
            Menampilkan {{ (utilityPagination.pageIndex * utilityPagination.pageSize) + 1 }} - 
            {{ Math.min((utilityPagination.pageIndex + 1) * utilityPagination.pageSize, utilityTable?.tableApi?.getFilteredRowModel().rows.length || 0) }} 
            dari {{ utilityTable?.tableApi?.getFilteredRowModel().rows.length || 0 }}
          </span>
          <UPagination
            :page="(utilityTable?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="utilityTable?.tableApi?.getState().pagination.pageSize"
            :total="utilityTable?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p) => utilityTable?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
      <div v-if="filteredUtilityBills.length === 0" class="text-center py-16">
        <p class="text-gray-500">Tidak ada tagihan utilitas ditemukan.</p>
        <p class="text-gray-400 text-sm mt-1">
          Tagihan utilitas otomatis dibuat saat Anda menambah pembacaan meter.
        </p>
      </div>
    </UCard>

    <!-- Combined Statements Table -->
    <UCard v-if="activeTab === 'summary'">
      <!-- Mobile View: Accordion Cards -->
      <div v-if="combinedBills.length > 0" class="lg:hidden p-4 space-y-3">
        <!-- Search Filter Mobile -->
        <div class="mb-4">
          <UInput v-model="summaryFilter" placeholder="Cari kamar, nama penghuni..." icon="i-heroicons-magnifying-glass" />
        </div>
        
        <BillingSummaryCard
          v-for="item in mobileFilteredCombinedBills.slice(0, mobileLimits.summary)"
          :key="`${item.roomId}-${item.period}`"
          :item="item"
          :format-currency="formatCurrency"
          @send-whats-app="sendToWhatsApp"
          @print="printCombined"
        />
        
        <!-- Loading Skeleton -->
        <div v-if="mobileLoading.summary" class="space-y-3">
          <div class="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
            <div class="flex items-start gap-3">
              <div class="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="flex-1 space-y-3">
                <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mt-3"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination Buttons -->
        <div v-if="mobileFilteredCombinedBills.length > 5 && !mobileLoading.summary" class="flex justify-center gap-4 pt-2">
          <span 
            v-if="mobileLimits.summary < mobileFilteredCombinedBills.length"
            class="text-sm text-primary-600 dark:text-primary-400 font-medium cursor-pointer hover:underline"
            @click="loadMoreMobile('summary')"
          >
            Lebih Banyak
          </span>
          <span 
            v-if="mobileLimits.summary > 5"
            class="text-sm text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:underline"
            @click="resetMobileLimit('summary')"
          >
            Tampilkan Lebih Sedikit
          </span>
        </div>
      </div>
      
      <!-- Desktop View: UTable with Pagination -->
      <div v-if="combinedBills.length > 0" class="hidden lg:block">
        <!-- Search Filter -->
        <div class="flex px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <UInput v-model="summaryFilter" class="max-w-sm" placeholder="Cari kamar, nama penghuni..." icon="i-heroicons-magnifying-glass" />
        </div>
        
        <UTable
          ref="summaryTable"
          v-model:pagination="summaryPagination"
          v-model:global-filter="summaryFilter"
          :data="combinedBills"
          :columns="summaryColumns"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        >
          <!-- Period Cell -->
          <template #period-cell="{ row }">
            <span class="font-medium">{{ row.original.period }}</span>
          </template>
          
          <!-- Room Cell -->
          <template #room-cell="{ row }">
            <div class="font-medium">{{ row.original.rent?.room?.name || row.original.util?.room?.name || 'Unknown' }}</div>
            <div class="text-xs text-gray-500">{{ row.original.rent?.property?.name || row.original.util?.property?.name || 'Unknown' }}</div>
            <div v-if="row.original.rent?.tenant?.name || row.original.util?.tenant?.name" class="text-xs text-gray-500">
              {{ row.original.rent?.tenant?.name || row.original.util?.tenant?.name }}
            </div>
          </template>
          
          <!-- Rent Cell -->
          <template #rent-cell="{ row }">
            <div v-if="row.original.rent">
              {{ formatCurrency(row.original.rent.totalAmount) }}
              <UIcon
                v-if="row.original.rent.isPaid"
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
          </template>
          
          <!-- Utility Cell -->
          <template #utility-cell="{ row }">
            <div v-if="row.original.util">
              {{ formatCurrency(row.original.util.totalAmount) }}
              <UIcon
                v-if="row.original.util.isPaid"
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
          </template>
          
          <!-- Total Cell -->
          <template #total-cell="{ row }">
            <span class="font-bold">
              {{ formatCurrency(Number(row.original.rent?.totalAmount || 0) + Number(row.original.util?.totalAmount || 0)) }}
            </span>
          </template>
          
          <!-- Status Cell -->
          <template #status-cell="{ row }">
            <UBadge
              :color="
                row.original.rent?.isPaid !== false && row.original.util?.isPaid !== false
                  ? 'success'
                  : row.original.rent?.isPaid || row.original.util?.isPaid
                    ? 'warning'
                    : 'error'
              "
              variant="subtle"
              size="xs"
            >
              {{
                row.original.rent?.isPaid !== false && row.original.util?.isPaid !== false
                  ? 'PAID'
                  : row.original.rent?.isPaid || row.original.util?.isPaid
                    ? 'PARTIAL'
                    : 'UNPAID'
              }}
            </UBadge>
          </template>
          
          <!-- Actions Cell -->
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UTooltip text="Bayar Sewa" v-if="row.original.rent && !row.original.rent.isPaid">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-banknotes"
                  @click="openPaymentModal(row.original.rent.id, 'rent')"
                />
              </UTooltip>
              <UTooltip text="Bayar Utilitas" v-if="row.original.util && !row.original.util.isPaid">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-bolt"
                  @click="openPaymentModal(row.original.util.id, 'utility')"
                />
              </UTooltip>
              <UTooltip text="Kirim ke WhatsApp">
                <UButton
                  size="xs"
                  class="bg-[#25D366] hover:bg-[#128C7E] text-white"
                  icon="i-simple-icons-whatsapp"
                  @click="sendToWhatsApp(row.original)"
                /></UTooltip>
              <UTooltip text="Cetak Laporan">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-printer"
                  @click="printCombined(row.original)"
                /></UTooltip>
            </div>
          </template>
        </UTable>
        
        <!-- Pagination -->
        <div class="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4 px-4 pb-4">
          <span class="text-sm text-gray-500">
            Menampilkan {{ (summaryPagination.pageIndex * summaryPagination.pageSize) + 1 }} - 
            {{ Math.min((summaryPagination.pageIndex + 1) * summaryPagination.pageSize, summaryTable?.tableApi?.getFilteredRowModel().rows.length || 0) }} 
            dari {{ summaryTable?.tableApi?.getFilteredRowModel().rows.length || 0 }}
          </span>
          <UPagination
            :page="(summaryTable?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="summaryTable?.tableApi?.getState().pagination.pageSize"
            :total="summaryTable?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p) => summaryTable?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
      <div v-if="combinedBills.length === 0" class="text-center py-16">
        <p class="text-gray-500">Tidak ada data untuk ringkasan.</p>
      </div>
    </UCard>
  </div>

  <!-- Generate Rent Bill Modal -->
  <UModal :open="isGenerating" @close="isGenerating = false">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-lg">Buat Tagihan Sewa</h3>
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
              {{ genPropertyId 
                ? 'Tidak ada kamar di properti ini' 
                : 'Pilih properti terlebih dahulu' }}
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
  
  <!-- Payment Modal -->
  <UModal :open="paymentModalOpen" @close="paymentModalOpen = false">
    <template #content>
      <PaymentModal
        v-if="paymentBillData"
        :bill-id="paymentBillId || ''"
        :bill-type="paymentBillType"
        :total-amount="Number(paymentBillData.totalAmount)"
        :paid-amount="Number(paymentBillData.paidAmount || 0)"
        :is-paid="paymentBillData.isPaid"
        @payment-added="handlePaymentAdded"
        @close="paymentModalOpen = false"
      />
    </template>
  </UModal>
  
  <!-- Payment History Modal -->
  <UModal :open="paymentHistoryOpen" @close="paymentHistoryOpen = false">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Riwayat Pembayaran</h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="paymentHistoryOpen = false"
            />
          </div>
        </template>
        
        <PaymentHistory
          v-if="paymentHistoryOpen && paymentHistoryBillId"
          :bill-id="paymentHistoryBillId"
          :bill-type="paymentHistoryBillType"
        />
      </UCard>
    </template>
  </UModal>
</template>
