<script setup lang="ts">
import { useKosStore } from '~/stores/kos';
import { storeToRefs } from 'pinia';

const kosStore = useKosStore();
const { properties, reminders, remindersLoading, rentBills, utilityBills, rooms, tenants } = storeToRefs(kosStore);
const toast = useToast();
const hasMounted = ref(false);

const { data: authData } = await useAuthFetch('/api/auth/me');
const isStaff = computed(() => (authData.value as any)?.user?.role === 'staff');

onMounted(async () => {
    hasMounted.value = true;

    await Promise.all([
        kosStore.fetchProperties(),
        kosStore.fetchReminders(),
        kosStore.fetchRentBills(),
        kosStore.fetchUtilityBills(),
        kosStore.fetchRooms({ all: true }),
        kosStore.fetchTenants({ all: true }),
    ]);
});

// Filters
const searchQuery = ref('');
const selectedPropertyId = ref('all');

const propertyItems = computed(() => [
    { label: 'Semua Properti', value: 'all' },
    ...properties.value.map(p => ({ label: p.name, value: p.id }))
]);

// Fetch all occupied rooms
const { data: roomsData, refresh: refreshRooms, pending: isLoading } = await useAuthFetch('/api/meter-readings/rooms', {
    query: computed(() => ({
        all: true,
        propertyId: selectedPropertyId.value !== 'all' ? selectedPropertyId.value : undefined,
        occupancy: 'occupied',
        search: searchQuery.value || undefined,
    })),
    watch: [selectedPropertyId, searchQuery]
});

const paginatedRooms = computed(() => (roomsData.value as any)?.data || []);
const showRefreshLoading = computed(() => hasMounted.value && (isLoading.value || remindersLoading.value));
const showRoomsLoading = computed(() => hasMounted.value && isLoading.value && paginatedRooms.value.length === 0);

// Collapsible sections per property
const collapsedGroups = ref<Set<string>>(new Set())

const toggleGroup = (propertyId: string) => {
    if (collapsedGroups.value.has(propertyId)) {
        collapsedGroups.value.delete(propertyId)
    } else {
        collapsedGroups.value.add(propertyId)
    }
}

const isGroupCollapsed = (propertyId: string) => {
    return collapsedGroups.value.has(propertyId)
}

// Group rooms by property
const groupedRooms = computed(() => {
    const groups = new Map<string, any>()
    const NO_PROPERTY_KEY = '__no_property__'

    for (const room of paginatedRooms.value) {
        const propertyId = room.propertyId || NO_PROPERTY_KEY
        const propertyName = room.property?.name || 'Belum Ada Properti'

        if (!groups.has(propertyId)) {
            groups.set(propertyId, {
                propertyId,
                propertyName,
                rooms: []
            })
        }
        groups.get(propertyId)!.rooms.push(room)
    }

    const result = Array.from(groups.values())
    result.sort((a, b) => {
        if (a.propertyId === NO_PROPERTY_KEY) return 1
        if (b.propertyId === NO_PROPERTY_KEY) return -1
        return a.propertyName.localeCompare(b.propertyName)
    })

    return result
})

const parseLocalDate = (value?: string | null) => {
    if (!value) return null

    const dateOnly = value.split('T')[0]
    const [year, month, day] = dateOnly.split('-').map(Number)
    if (!year || !month || !day) return null

    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const getTodayLocalDate = () => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
}

const formatDisplayDate = (value?: string | null) => {
    const parsed = parseLocalDate(value)
    if (!parsed) return value || ''

    return parsed.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

const today = new Date()
today.setHours(0, 0, 0, 0)

const getUtilityBillDueDate = (bill: any) => {
    const generatedAt = parseLocalDate(bill.generatedAt)
    if (!generatedAt) return null

    const dueDate = new Date(generatedAt)
    dueDate.setDate(dueDate.getDate() + 7)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate
}

const isRentBillActive = (bill: any) => {
    if (!bill.isPaid) return true

    const dueDate = parseLocalDate(bill.dueDate) || parseLocalDate(bill.periodEndDate)
    return !!dueDate && dueDate >= today
}

const isUtilityBillActive = (bill: any) => {
    if (!bill.isPaid) return true

    const dueDate = getUtilityBillDueDate(bill)
    return !!dueDate && dueDate >= today
}

// Build a per-room bill status using active bill data only
// Status: 'belum_lunas' | 'lunas' | 'tidak_ada_tagihan_aktif'
const roomBillStatus = computed(() => {
    const map: Record<string, { status: 'belum_lunas' | 'lunas' | 'tidak_ada_tagihan_aktif'; totalUnpaid: number; billCount: number; daysUntilDue: number | null; dueDate: string | null }> = {};
    
    // Process rent bills
    for (const bill of rentBills.value) {
        if (!isRentBillActive(bill)) continue

        const roomId = bill.roomId;
        if (!map[roomId]) {
            map[roomId] = { status: 'lunas', totalUnpaid: 0, billCount: 0, daysUntilDue: null, dueDate: null };
        }
        if (!bill.isPaid) {
            map[roomId].status = 'belum_lunas';
            map[roomId].totalUnpaid += Number(bill.totalAmount);
            map[roomId].billCount++;
        }
    }
    
    // Process utility bills
    for (const bill of utilityBills.value) {
        if (!isUtilityBillActive(bill)) continue

        const roomId = bill.roomId;
        if (!map[roomId]) {
            map[roomId] = { status: 'lunas', totalUnpaid: 0, billCount: 0, daysUntilDue: null, dueDate: null };
        }
        if (!bill.isPaid) {
            map[roomId].status = 'belum_lunas';
            map[roomId].totalUnpaid += Number(bill.totalAmount);
            map[roomId].billCount++;
        }
    }
    
    // Enrich with reminder urgency data
    const allReminders = [
        ...reminders.value.overdue,
        ...reminders.value.dueSoon,
        ...reminders.value.upcoming
    ];
    for (const rem of allReminders) {
        const roomId = rem.roomId;
        if (map[roomId]) {
            if (map[roomId].daysUntilDue === null || rem.daysUntilDue < map[roomId].daysUntilDue!) {
                map[roomId].daysUntilDue = rem.daysUntilDue;
                map[roomId].dueDate = rem.dueDate;
            }
        }
    }
    
    return map;
});

const getRoomStatus = (roomId: string) => {
    return roomBillStatus.value[roomId] || { status: 'tidak_ada_tagihan_aktif' as const, totalUnpaid: 0, billCount: 0, daysUntilDue: null, dueDate: null };
};

// Detail Modal
const showDetails = ref(false);
const selectedRoom = ref<any>(null);
const isFetchingBills = ref(false);
const roomRentBills = ref<any[]>([]);
const roomUtilityBills = ref<any[]>([]);

// Generate Bill Modal State
const showGenerateModal = ref(false);
const isGenerating = ref(false);
const genPeriodStartDate = ref(formatLocalDate(getTodayLocalDate()));
const genMonthsCovered = ref(1);

// Period end computed from start + months
const genPeriodEndDate = computed(() => {
    if (!genPeriodStartDate.value) return '';
    const start = parseLocalDate(genPeriodStartDate.value);
    if (!start) return '';

    const end = new Date(start);
    end.setMonth(end.getMonth() + genMonthsCovered.value);
    end.setDate(end.getDate() - 1);
    return formatLocalDate(end);
});

const genDueDate = computed(() => genPeriodEndDate.value);

// Format date range helper
const formatDateRange = (start: string, end: string) => {
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    if (!s || !e) return `${start} - ${end}`;

    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${s.toLocaleDateString('id-ID', opts)} - ${e.toLocaleDateString('id-ID', opts)}`;
};

// Auto-set to next billing cycle from moveInDate (same logic as billing page)
const setNextBillingCycle = () => {
    if (!selectedRoom.value?.moveInDate) return;
    const [, , dayStr] = selectedRoom.value.moveInDate.split('-');
    const cycleDay = Number(dayStr);

    const existing = rentBills.value
        .filter(b => b.roomId === selectedRoom.value?.id)
        .sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate));

    const latestBill = existing[0];
    if (latestBill) {
        const latestEndDate = parseLocalDate(latestBill.periodEndDate);
        if (latestEndDate) {
            const nextStartDate = new Date(latestEndDate);
            nextStartDate.setDate(nextStartDate.getDate() + 1);
            genPeriodStartDate.value = formatLocalDate(nextStartDate);
            return;
        }
    }

    const today = getTodayLocalDate();
    let nextYear = today.getFullYear();
    let nextMonth = today.getMonth();
    if (today.getDate() > cycleDay) {
        nextMonth++;
        if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    }

    const maxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
    const nextDay = Math.min(cycleDay, maxDay);
    genPeriodStartDate.value = formatLocalDate(new Date(nextYear, nextMonth, nextDay, 0, 0, 0, 0));
};

// Existing bill ranges for the selected room
const existingRentBillRanges = computed(() => {
    if (!selectedRoom.value) return [];
    return rentBills.value
        .filter(b => b.roomId === selectedRoom.value.id)
        .map(b => ({ start: b.periodStartDate, end: b.periodEndDate, formatted: formatDateRange(b.periodStartDate, b.periodEndDate) }));
});

// Conflict check
const dateRangeConflict = computed(() => {
    if (!genPeriodStartDate.value || !genPeriodEndDate.value || !selectedRoom.value) return null;
    const ns = parseLocalDate(genPeriodStartDate.value);
    const ne = parseLocalDate(genPeriodEndDate.value);
    if (!ns || !ne) return null;

    for (const bill of rentBills.value.filter(b => b.roomId === selectedRoom.value.id)) {
        const bs = parseLocalDate(bill.periodStartDate);
        const be = parseLocalDate(bill.periodEndDate);
        if (!bs || !be) continue;

        if (ns <= be && ne >= bs) return formatDateRange(bill.periodStartDate, bill.periodEndDate);
    }
    return null;
});

// Disabled dates (already billed or before moveIn)
const isDateUnavailable = computed(() => {
    return (date: any) => {
        const check = new Date(date.year, date.month - 1, date.day);
        check.setHours(0, 0, 0, 0);
        if (selectedRoom.value?.moveInDate) {
            const moveIn = parseLocalDate(selectedRoom.value.moveInDate);
            if (!moveIn) return false;
            if (check < moveIn) return true;
        }
        for (const bill of rentBills.value.filter(b => b.roomId === selectedRoom.value?.id)) {
            const bs = parseLocalDate(bill.periodStartDate);
            const be = parseLocalDate(bill.periodEndDate);
            if (!bs || !be) continue;

            if (check >= bs && check <= be) return true;
        }
        return false;
    };
});

// Open generate modal for a specific room (from detail modal)
const openGenerateModal = () => {
    genMonthsCovered.value = 1;
    setNextBillingCycle();
    showGenerateModal.value = true;
};

// Format helpers
const formatCurrency = (amount: number | string) => {
    return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

const formatPeriodMonth = (periodStr?: string | null) => {
    if (!periodStr) return ''
    try {
        const [year, month] = periodStr.split('-').map(Number)
        const d = new Date(year, month - 1, 1)
        return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d)
    } catch(e) {
        return periodStr
    }
}

const openDetails = async (room: any) => {
    selectedRoom.value = room;
    showDetails.value = true;
    roomRentBills.value = [];
    roomUtilityBills.value = [];
    isFetchingBills.value = true;

    const roomId = room.id;

    try {
        const [rentData, utilityData] = await Promise.all([
            $fetch<any[]>('/api/rent-bills', { query: { roomId } }),
            $fetch<any[]>('/api/utility-bills', { query: { roomId } })
        ]);

        if (rentData && rentData.length > 0) {
            // Sort rent bills descending by period, pick the latest one
            rentData.sort((a, b) => {
                const pA = a.bill?.period || ''
                const pB = b.bill?.period || ''
                return pB.localeCompare(pA)
            })
            roomRentBills.value = [rentData[0]]
        } else {
            roomRentBills.value = []
        }

        roomUtilityBills.value = utilityData || [];
        // Sort utility descending by period
        roomUtilityBills.value.sort((a, b) => {
            const pA = a.bill?.period || ''
            const pB = b.bill?.period || ''
            return pB.localeCompare(pA)
        });
        // Keep only the latest one
        if (roomUtilityBills.value.length > 0) {
            roomUtilityBills.value = [roomUtilityBills.value[0]];
        }
    } catch (e) {
        console.error('Failed to fetch room bills', e)
    } finally {
        isFetchingBills.value = false;
    }
};

// All Bills paid?
const allBillsPaid = computed(() => {
    const hasBills = roomRentBills.value.length > 0 || roomUtilityBills.value.length > 0;
    if (!hasBills) return true; // No bills = nothing unpaid
    const rentPaid = roomRentBills.value.length === 0 || roomRentBills.value.every(r => r.bill?.isPaid);
    const utilPaid = roomUtilityBills.value.length === 0 || roomUtilityBills.value.every(r => r.bill?.isPaid);
    return rentPaid && utilPaid;
});

const hasAnyBills = computed(() => roomRentBills.value.length > 0 || roomUtilityBills.value.length > 0);

// Generate Rent Bill from modal
// Submit generate bill from modal
const generateRentBill = async () => {
    if (!selectedRoom.value) return;
    if (dateRangeConflict.value) {
        toast.add({ title: 'Konflik', description: `Periode ${dateRangeConflict.value} sudah memiliki tagihan.`, color: 'error' });
        return;
    }
    isGenerating.value = true;
    try {
        await kosStore.generateRentBill({
            roomId: selectedRoom.value.id,
            periodStartDate: genPeriodStartDate.value,
            monthsCovered: genMonthsCovered.value,
            roomPrice: Number(selectedRoom.value.price || 0),
        });
        toast.add({ title: 'Berhasil', description: 'Tagihan sewa berhasil dibuat', color: 'success' });
        showGenerateModal.value = false;
        await openDetails(selectedRoom.value);
        await kosStore.fetchReminders();
        await kosStore.fetchRentBills();
    } catch (err: any) {
        const msg = err?.data?.message || err?.message || 'Gagal membuat tagihan sewa';
        toast.add({ title: 'Error', description: msg, color: 'error' });
    } finally {
        isGenerating.value = false;
    }
};

// WhatsApp
const sendingWa = ref<string | null>(null);
const { buildMessage, getDefaultTemplate, prepareWhatsAppTab, openWhatsApp } = useWhatsAppTemplate();

const sendWhatsApp = async (room: any) => {
    const phone = room.tenant?.contact || room.tenantContact;
    if (!phone) {
        toast.add({ title: 'Error', description: 'Nomor kontak tidak tersedia', color: 'error' });
        return;
    }

    const pendingTab = prepareWhatsAppTab();

    sendingWa.value = room.id;
    let invoiceUrl = '';

    // Collect unpaid bills
    const unpaidRent = roomRentBills.value.filter(r => !r.bill?.isPaid);
    const unpaidUtil = roomUtilityBills.value.filter(u => !u.bill?.isPaid);

    try {
        // Use combined link when both types exist for the same period
        const rentPeriod = unpaidRent[0]?.bill?.period;
        const utilPeriod = unpaidUtil[0]?.bill?.period;

        if (unpaidRent.length > 0 && unpaidUtil.length > 0 && rentPeriod === utilPeriod) {
            // Combined link (same period)
            const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
                `/api/bills/public-link/combined`,
                { method: 'POST', body: { roomId: room.id, period: rentPeriod } }
            );
            invoiceUrl = linkResponse.publicUrl;
        } else if (unpaidRent.length > 0 && unpaidUtil.length > 0) {
            // Different periods - use dual bill ID format
            const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
                `/api/bills/public-link/combined`,
                { method: 'POST', body: { rentBillId: unpaidRent[0].bill.id, utilBillId: unpaidUtil[0].bill.id } }
            );
            invoiceUrl = linkResponse.publicUrl;
        } else if (unpaidRent.length > 0) {
            // Only rent
            const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
                `/api/bills/public-link/${unpaidRent[0].bill.id}`,
                { method: 'POST', body: { billType: 'rent' } }
            );
            invoiceUrl = linkResponse.publicUrl;
        } else if (unpaidUtil.length > 0) {
            // Only utility
            const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
                `/api/bills/public-link/${unpaidUtil[0].bill.id}`,
                { method: 'POST', body: { billType: 'utility' } }
            );
            invoiceUrl = linkResponse.publicUrl;
        }
    } catch (e) {
        console.error('Failed to generate link', e);
        toast.add({ title: 'Warning', description: 'Gagal generate link invoice', color: 'warning' });
    }

    let rentTotal = 0;
    let utilityTotal = 0;
    let rentBill: any = null;
    let utilBill: any = null;

    for (const r of roomRentBills.value) {
        if (!r.bill?.isPaid) { rentTotal += Number(r.bill.totalAmount); rentBill = r.bill; }
    }
    for (const u of roomUtilityBills.value) {
        if (!u.bill?.isPaid) { utilityTotal += Number(u.bill.totalAmount); utilBill = u.bill; }
    }

    const templateType = 'reminder_due_soon';
    const template = await getDefaultTemplate(templateType);

    const billingData = {
        tenantName: room.tenantName || room.tenant?.name,
        propertyName: room.property?.name,
        roomName: room.name,
        period: rentBill?.period || utilBill?.period || 'N/A',
        rentPeriod: rentBill ? formatDateRange(rentBill.periodStartDate, rentBill.periodEndDate) : '',
        utilityPeriod: utilBill ? formatPeriodMonth(utilBill.period) : '',
        occupantCount: room.occupantCount || 1,
        daysUntilDue: 0,
        rentAmount: rentTotal,
        monthsCovered: rentBill?.monthsCovered || 1,
        roomPrice: rentBill?.roomPrice || 0,
        isRentPaid: false,
        meterStart: utilBill?.meterStart,
        meterEnd: utilBill?.meterEnd,
        usageCost: utilBill?.usageCost || 0,
        waterFee: utilBill?.waterFee || 0,
        trashFee: utilBill?.trashFee || 0,
        utilityTotal: utilityTotal,
        isUtilityPaid: false,
        grandTotal: rentTotal + utilityTotal,
        invoiceUrl: invoiceUrl || undefined
    };

    const message = buildMessage(template.message, billingData);
    sendingWa.value = null;
    const opened = openWhatsApp(phone, message, pendingTab);
    if (!opened) {
        toast.add({ title: 'Popup Diblokir', description: 'Browser memblokir tab WhatsApp baru. Izinkan pop-up untuk situs ini lalu coba lagi.', color: 'warning' });
    }
};

const refreshAll = async () => {
    await Promise.all([
        refreshRooms(),
        kosStore.fetchReminders()
    ]);
};
</script>

<template>
  <div class="p-4 sm:p-8">
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Pengingat Tagihan</h1>
        <p class="text-gray-600 dark:text-gray-400">Kelola tagihan dan kirim pengingat untuk semua kamar terisi.</p>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Cari penghuni atau kamar..."
          class="w-full sm:w-64"
        />
        <USelect
          v-model="selectedPropertyId"
          :items="propertyItems"
          class="w-full sm:w-48"
        />
                <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" :loading="showRefreshLoading" @click="refreshAll">
            Refresh
        </UButton>
      </div>
    </div>

    <!-- Loading -->
        <div v-if="showRoomsLoading" class="py-12 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
    </div>

    <!-- Empty State -->
    <div v-else-if="groupedRooms.length === 0" class="py-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
       <UIcon name="i-heroicons-home-modern" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
       <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Tidak Ada Kamar Terisi</h3>
       <p class="text-gray-500">Belum ada kamar yang terisi sesuai filter.</p>
    </div>

    <!-- Rooms Grouped by Property -->
    <div v-else class="space-y-6">
      <section v-for="propertyGroup in groupedRooms" :key="propertyGroup.propertyId">
        <!-- Property Header -->
        <div 
          class="flex items-center gap-2 mb-3 cursor-pointer select-none"
          @click="toggleGroup(propertyGroup.propertyId)"
        >
           <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 flex-1">
             {{ propertyGroup.propertyName }} 
             <span class="text-gray-500 font-normal text-base ml-2">({{ propertyGroup.rooms.length }} Kamar)</span>
           </h2>
           <UIcon 
             :name="isGroupCollapsed(propertyGroup.propertyId) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'" 
             class="w-5 h-5 text-gray-400 transition-transform"
           />
        </div>
        
        <!-- Room List -->
        <div v-show="!isGroupCollapsed(propertyGroup.propertyId)" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden">
            <div 
                v-for="room in propertyGroup.rooms" 
                :key="room.id" 
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                @click="openDetails(room)"
            >
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <!-- Status Icon -->
                        <div 
                          class="p-2 rounded-lg shrink-0 flex items-center justify-center"
                          :class="{
                            'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400': getRoomStatus(room.id).status === 'belum_lunas' && getRoomStatus(room.id).daysUntilDue !== null && getRoomStatus(room.id).daysUntilDue! < 0,
                            'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400': getRoomStatus(room.id).status === 'belum_lunas' && (getRoomStatus(room.id).daysUntilDue === null || getRoomStatus(room.id).daysUntilDue! >= 0),
                            'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400': getRoomStatus(room.id).status === 'lunas',
                                                        'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400': getRoomStatus(room.id).status === 'tidak_ada_tagihan_aktif',
                          }"
                        >
                            <UIcon 
                                                            :name="getRoomStatus(room.id).status === 'lunas' ? 'i-heroicons-check-circle' : (getRoomStatus(room.id).status === 'tidak_ada_tagihan_aktif' ? 'i-heroicons-document-plus' : (getRoomStatus(room.id).daysUntilDue !== null && getRoomStatus(room.id).daysUntilDue! < 0 ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-clock'))" 
                              class="w-5 h-5" 
                            />
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ room.tenantName || 'Penghuni' }}</h4>
                            <p class="text-sm text-gray-500 truncate">{{ room.name }}</p>
                            <div class="mt-1 flex items-center gap-2 flex-wrap">
                                 <!-- Belum Lunas Badges -->
                                 <template v-if="getRoomStatus(room.id).status === 'belum_lunas'">
                                   <UBadge 
                                     :color="getRoomStatus(room.id).daysUntilDue !== null && getRoomStatus(room.id).daysUntilDue! < 0 ? 'error' : 'warning'" 
                                     variant="subtle" 
                                     size="xs"
                                   >
                                      <template v-if="getRoomStatus(room.id).daysUntilDue !== null && getRoomStatus(room.id).daysUntilDue! < 0">
                                          Lewat {{ Math.abs(getRoomStatus(room.id).daysUntilDue!) }} hari
                                      </template>
                                      <template v-else-if="getRoomStatus(room.id).daysUntilDue === 0">
                                          Jatuh tempo hari ini
                                      </template>
                                      <template v-else-if="getRoomStatus(room.id).daysUntilDue !== null">
                                          {{ getRoomStatus(room.id).daysUntilDue }} hari lagi
                                      </template>
                                      <template v-else>
                                          Belum Lunas
                                      </template>
                                   </UBadge>
                                 </template>
                                 <!-- Lunas Badge -->
                                 <UBadge v-else-if="getRoomStatus(room.id).status === 'lunas'" color="success" variant="subtle" size="xs">
                                    Lunas
                                 </UBadge>
                                            <!-- No Active Bill Badge -->
                                 <UBadge v-else color="neutral" variant="subtle" size="xs">
                                                Tidak Ada Tagihan Aktif
                                 </UBadge>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <div class="text-right" v-if="getRoomStatus(room.id).status === 'belum_lunas'">
                            <div class="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(getRoomStatus(room.id).totalUnpaid) }}</div>
                            <div class="text-xs text-gray-500 uppercase hidden sm:block">{{ getRoomStatus(room.id).billCount }} Tagihan</div>
                        </div>
                        <div class="text-right" v-else-if="getRoomStatus(room.id).status === 'lunas'">
                            <div class="text-sm font-medium text-green-600 dark:text-green-400">✓</div>
                        </div>
                        <div class="text-right" v-else>
                            <div class="text-sm font-medium text-gray-400">-</div>
                        </div>
                        <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-400" />
                    </div>
                </div>
            </div>
        </div>
      </section>
    </div>

    <!-- Detail Modal -->
    <UModal 
      v-model:open="showDetails"
      title="Detail Tagihan"
      :description="selectedRoom ? `${selectedRoom.tenantName || 'Penghuni'} • ${selectedRoom.name}` : ''"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div v-if="selectedRoom" class="space-y-4">
            <!-- Loading -->
            <div v-if="isFetchingBills" class="flex items-center gap-2 p-4 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" /> Memuat tagihan...
            </div>

            <template v-else>
                <!-- Room Info Header -->
                <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    <UAvatar :alt="selectedRoom.tenantName || 'P'" size="md" class="bg-primary-100 text-primary-600 ring-2 ring-white dark:ring-gray-900 shrink-0" />
                    <div class="min-w-0">
                        <div class="font-semibold text-gray-900 dark:text-white">{{ selectedRoom.tenantName || 'Penghuni' }}</div>
                        <div class="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
                            <UIcon name="i-heroicons-building-office-2" class="w-3.5 h-3.5 shrink-0" />
                            <span>{{ selectedRoom.property?.name }}</span>
                            <span class="text-gray-300 dark:text-gray-600">•</span>
                            <UIcon name="i-heroicons-home" class="w-3.5 h-3.5 shrink-0" />
                            <span>{{ selectedRoom.name }}</span>
                            <span class="text-gray-300 dark:text-gray-600">•</span>
                            <UIcon name="i-heroicons-users" class="w-3.5 h-3.5 shrink-0" />
                            <span>{{ selectedRoom.occupantCount || 1 }} orang</span>
                        </div>
                    </div>
                </div>

                <!-- Rent Bill Section -->
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800">
                        <span class="text-xs font-bold uppercase text-gray-500 tracking-wide">Tagihan Sewa</span>
                        <div class="flex items-center gap-2">
                            <span v-if="roomRentBills.length > 0" class="text-xs text-gray-500">{{ formatPeriodMonth(roomRentBills[0].bill?.period) }}</span>
                            <UButton 
                                v-if="!isStaff"
                                size="xs" 
                                color="primary" 
                                variant="soft"
                                icon="i-heroicons-plus"
                                @click="openGenerateModal"
                            >
                                Buat Tagihan Baru
                            </UButton>
                        </div>
                    </div>
                    
                    <template v-if="roomRentBills.length > 0">
                        <div class="p-4 space-y-2 text-sm">
                            <!-- Room Price -->
                            <div class="flex justify-between text-gray-700 dark:text-gray-300">
                                <span>Sewa Kamar
                                    <span v-if="roomRentBills[0].bill?.monthsCovered > 1" class="text-gray-500">
                                        ({{ roomRentBills[0].bill.monthsCovered }} bulan)
                                    </span>
                                </span>
                                <span class="font-medium">{{ formatCurrency(roomRentBills[0].bill?.roomPrice || 0) }}</span>
                            </div>
                            <div class="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between items-center font-semibold">
                                <span class="text-gray-900 dark:text-white">Total Sewa</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-gray-900 dark:text-white">{{ formatCurrency(roomRentBills[0].bill.totalAmount) }}</span>
                                    <UBadge :color="roomRentBills[0].bill.isPaid ? 'success' : (roomRentBills[0].bill.paidAmount && Number(roomRentBills[0].bill.paidAmount) > 0 ? 'warning' : 'error')" variant="subtle" size="xs">
                                        {{ roomRentBills[0].bill.isPaid ? 'Lunas' : (roomRentBills[0].bill.paidAmount && Number(roomRentBills[0].bill.paidAmount) > 0 ? 'Sebagian' : 'Belum Lunas') }}
                                    </UBadge>
                                </div>
                            </div>
                            <!-- Partial paid info -->
                            <div v-if="!roomRentBills[0].bill.isPaid && Number(roomRentBills[0].bill.paidAmount) > 0" class="text-xs text-gray-500 space-y-0.5">
                                <div class="flex justify-between text-green-600 dark:text-green-400">
                                    <span>Sudah dibayar</span>
                                    <span>{{ formatCurrency(roomRentBills[0].bill.paidAmount) }}</span>
                                </div>
                                <div class="flex justify-between text-red-600 dark:text-red-400 font-medium">
                                    <span>Sisa</span>
                                    <span>{{ formatCurrency(Number(roomRentBills[0].bill.totalAmount) - Number(roomRentBills[0].bill.paidAmount)) }}</span>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div class="p-4">
                            <span class="text-sm text-gray-500">Belum ada tagihan sewa</span>
                        </div>
                    </template>
                </div>

                <!-- Utility Bill Section -->
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800">
                        <span class="text-xs font-bold uppercase text-gray-500 tracking-wide">Tagihan Utilitas</span>
                        <span v-if="roomUtilityBills.length > 0" class="text-xs text-gray-500">{{ formatPeriodMonth(roomUtilityBills[0].bill?.period) }}</span>
                    </div>
                    
                    <template v-if="roomUtilityBills.length > 0">
                        <div class="p-4 space-y-2 text-sm">
                            <!-- Meter reading -->
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="text-gray-700 dark:text-gray-300">Listrik</div>
                                    <div class="text-xs text-gray-400 font-mono mt-0.5">
                                        {{ roomUtilityBills[0].bill?.meterStart }} → {{ roomUtilityBills[0].bill?.meterEnd }}
                                        = {{ (roomUtilityBills[0].bill?.meterEnd || 0) - (roomUtilityBills[0].bill?.meterStart || 0) }} kWh
                                        × {{ formatCurrency(roomUtilityBills[0].bill?.costPerKwh || 0) }}
                                    </div>
                                </div>
                                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(roomUtilityBills[0].bill?.usageCost || 0) }}</span>
                            </div>
                            <!-- Water fee -->
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="text-gray-700 dark:text-gray-300">Air</div>
                                    <div class="text-xs text-gray-400 mt-0.5">
                                        {{ selectedRoom.occupantCount || 1 }} orang × {{ formatCurrency(Number(roomUtilityBills[0].bill?.waterFee || 0) / (selectedRoom.occupantCount || 1)) }}/orang
                                    </div>
                                </div>
                                <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(roomUtilityBills[0].bill?.waterFee || 0) }}</span>
                            </div>
                            <!-- Trash fee -->
                            <div v-if="Number(roomUtilityBills[0].bill?.trashFee) > 0" class="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Sampah</span>
                                <span>{{ formatCurrency(roomUtilityBills[0].bill.trashFee) }}</span>
                            </div>
                            <!-- Additional cost -->
                            <div v-if="Number(roomUtilityBills[0].bill?.additionalCost) > 0" class="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Biaya Lain</span>
                                <span>{{ formatCurrency(roomUtilityBills[0].bill.additionalCost) }}</span>
                            </div>
                            <div class="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between items-center font-semibold">
                                <span class="text-gray-900 dark:text-white">Total Utilitas</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-gray-900 dark:text-white">{{ formatCurrency(roomUtilityBills[0].bill.totalAmount) }}</span>
                                    <UBadge :color="roomUtilityBills[0].bill.isPaid ? 'success' : (roomUtilityBills[0].bill.paidAmount && Number(roomUtilityBills[0].bill.paidAmount) > 0 ? 'warning' : 'error')" variant="subtle" size="xs">
                                        {{ roomUtilityBills[0].bill.isPaid ? 'Lunas' : (roomUtilityBills[0].bill.paidAmount && Number(roomUtilityBills[0].bill.paidAmount) > 0 ? 'Sebagian' : 'Belum Lunas') }}
                                    </UBadge>
                                </div>
                            </div>
                            <!-- Partial paid info -->
                            <div v-if="!roomUtilityBills[0].bill.isPaid && Number(roomUtilityBills[0].bill.paidAmount) > 0" class="text-xs space-y-0.5">
                                <div class="flex justify-between text-green-600 dark:text-green-400">
                                    <span>Sudah dibayar</span>
                                    <span>{{ formatCurrency(roomUtilityBills[0].bill.paidAmount) }}</span>
                                </div>
                                <div class="flex justify-between text-red-600 dark:text-red-400 font-medium">
                                    <span>Sisa</span>
                                    <span>{{ formatCurrency(Number(roomUtilityBills[0].bill.totalAmount) - Number(roomUtilityBills[0].bill.paidAmount)) }}</span>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div class="p-4">
                            <span class="text-sm text-gray-500">Belum ada tagihan utilitas. Catat meter terlebih dahulu.</span>
                        </div>
                    </template>
                </div>

                <!-- Grand Total -->
                <div v-if="hasAnyBills" class="flex justify-between items-center font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span class="text-gray-900 dark:text-white">Total Belum Lunas</span>
                    <span class="text-lg text-primary-600 dark:text-primary-400">{{ formatCurrency(
                        (roomRentBills.length > 0 && !roomRentBills[0].bill.isPaid ? Number(roomRentBills[0].bill.totalAmount) - Number(roomRentBills[0].bill.paidAmount || 0) : 0) +
                        (roomUtilityBills.length > 0 && !roomUtilityBills[0].bill.isPaid ? Number(roomUtilityBills[0].bill.totalAmount) - Number(roomUtilityBills[0].bill.paidAmount || 0) : 0)
                    ) }}</span>
                </div>
            </template>
        </div>
      </template>

      <template #footer="{ close }">
        <UButton label="Tutup" size="lg" color="neutral" variant="outline" @click="close" />
        <UButton 
            label="Kirim WhatsApp" 
            size="lg" 
            icon="i-simple-icons-whatsapp" 
            class="bg-[#25D366] hover:bg-[#128C7E] text-white"
            :disabled="allBillsPaid || isFetchingBills"
            :loading="sendingWa === selectedRoom?.id"
            @click="sendWhatsApp(selectedRoom); close()" 
        />
      </template>
    </UModal>

    <!-- Generate Bill Modal -->
    <UModal :open="showGenerateModal" @close="showGenerateModal = false">
      <template #content>
        <UCard class="max-h-[90dvh] overflow-y-auto">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-lg">Buat Tagihan Sewa</h3>
                <p class="text-sm text-gray-500 mt-0.5" v-if="selectedRoom">
                  {{ selectedRoom.tenantName || 'Penghuni' }} • {{ selectedRoom.name }}
                </p>
              </div>
              <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="showGenerateModal = false" />
            </div>
          </template>

          <div class="space-y-4 p-1">
            <!-- Period Start -->
            <UFormField label="Tanggal Mulai Periode" required>
              <div class="flex gap-2 items-center">
                <DatePicker
                  v-model="genPeriodStartDate"
                  granularity="day"
                  class="flex-1"
                  :is-date-unavailable="isDateUnavailable"
                />
                <UButton
                  v-if="selectedRoom?.moveInDate"
                  variant="soft"
                  color="primary"
                  size="sm"
                  icon="i-heroicons-arrow-path"
                  @click="setNextBillingCycle"
                >
                  Auto
                </UButton>
              </div>

              <!-- MoveIn info -->
              <div v-if="selectedRoom?.moveInDate" class="mt-2">
                <p class="text-xs text-blue-600 dark:text-blue-400">
                  <UIcon name="i-heroicons-calendar" class="w-3 h-3 inline" />
                  Tanggal masuk:
                                    {{ formatDisplayDate(selectedRoom.moveInDate) }}
                </p>
              </div>

              <!-- Period preview -->
              <div v-if="genPeriodStartDate && genPeriodEndDate" class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <p class="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                  Periode: <strong>{{ formatDateRange(genPeriodStartDate, genPeriodEndDate) }}</strong>
                </p>
                <p class="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                    Due Date: {{ formatDisplayDate(genDueDate) }}
                </p>
              </div>

              <!-- Existing bills info -->
              <div v-if="existingRentBillRanges.length > 0" class="mt-2">
                <p class="text-xs text-gray-500">
                  Periode terisi:
                  <span class="font-mono font-semibold">{{ existingRentBillRanges.map(r => r.formatted).join('; ') }}</span>
                </p>
              </div>

              <!-- Conflict warning -->
              <div v-if="dateRangeConflict" class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <p class="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                  Konflik: Periode {{ dateRangeConflict }} sudah memiliki tagihan!
                </p>
              </div>
            </UFormField>

            <!-- Months Covered -->
            <UFormField label="Jumlah Bulan">
              <UInput type="number" v-model.number="genMonthsCovered" min="1" max="12" />
            </UFormField>

            <!-- Summary Card -->
            <div v-if="selectedRoom" class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg border border-primary-200 dark:border-primary-800">
              <div class="flex items-center gap-2 mb-3">
                <UIcon name="i-heroicons-calculator" class="w-5 h-5 text-primary-500" />
                <span class="font-semibold text-primary-700 dark:text-primary-300">Ringkasan Tagihan</span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Harga per Bulan:</span>
                  <span class="font-medium">{{ formatCurrency(selectedRoom.price) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Durasi:</span>
                  <span class="font-medium">{{ genMonthsCovered }} Bulan</span>
                </div>
                <div class="border-t border-primary-200 dark:border-primary-700 pt-2 mt-2">
                  <div class="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span class="text-primary-600 dark:text-primary-400">{{ formatCurrency(Number(selectedRoom.price) * genMonthsCovered) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="showGenerateModal = false">Batal</UButton>
              <UButton
                @click="generateRentBill"
                color="primary"
                :disabled="!!dateRangeConflict"
                :loading="isGenerating"
                icon="i-heroicons-document-plus"
              >
                Buat Tagihan
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
