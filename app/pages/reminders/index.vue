<script setup lang="ts">
import { useKosStore } from '~/stores/kos';
import { storeToRefs } from 'pinia';

const kosStore = useKosStore();
const { properties, reminders, remindersLoading, rentBills, utilityBills } = storeToRefs(kosStore);
const toast = useToast();

onMounted(async () => {
    await Promise.all([
        kosStore.fetchProperties(),
        kosStore.fetchReminders(),
        kosStore.fetchRentBills(),
        kosStore.fetchUtilityBills()
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

// Build a per-room bill status using actual bill data from the store
// Status: 'belum_lunas' | 'lunas' | 'belum_ada'
const roomBillStatus = computed(() => {
    const map: Record<string, { status: 'belum_lunas' | 'lunas' | 'belum_ada'; totalUnpaid: number; billCount: number; daysUntilDue: number | null; dueDate: string | null }> = {};
    
    // Process rent bills
    for (const bill of rentBills.value) {
        const roomId = bill.roomId;
        if (!map[roomId]) {
            map[roomId] = { status: 'lunas', totalUnpaid: 0, billCount: 0, daysUntilDue: null, dueDate: null };
        }
        map[roomId].billCount++;
        if (!bill.isPaid) {
            map[roomId].status = 'belum_lunas';
            map[roomId].totalUnpaid += Number(bill.totalAmount);
        }
    }
    
    // Process utility bills
    for (const bill of utilityBills.value) {
        const roomId = bill.roomId;
        if (!map[roomId]) {
            map[roomId] = { status: 'lunas', totalUnpaid: 0, billCount: 0, daysUntilDue: null, dueDate: null };
        }
        map[roomId].billCount++;
        if (!bill.isPaid) {
            map[roomId].status = 'belum_lunas';
            map[roomId].totalUnpaid += Number(bill.totalAmount);
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
    return roomBillStatus.value[roomId] || { status: 'belum_ada' as const, totalUnpaid: 0, billCount: 0, daysUntilDue: null, dueDate: null };
};

// Detail Modal
const showDetails = ref(false);
const selectedRoom = ref<any>(null);
const isFetchingBills = ref(false);
const roomRentBills = ref<any[]>([]);
const roomUtilityBills = ref<any[]>([]);
const isGenerating = ref(false);

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
const generateRentBill = async () => {
    if (!selectedRoom.value) return;
    isGenerating.value = true;

    const room = selectedRoom.value;
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const periodStartDate = room.moveInDate 
        ? (() => {
            const moveDay = new Date(room.moveInDate).getDate();
            const y = nextMonth.getFullYear();
            const m = nextMonth.getMonth();
            return `${y}-${String(m + 1).padStart(2, '0')}-${String(moveDay).padStart(2, '0')}`;
          })()
        : `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    try {
        await kosStore.generateRentBill({
            roomId: room.id,
            periodStartDate,
            roomPrice: Number(room.price || 0),
        });
        toast.add({ title: 'Berhasil', description: 'Tagihan sewa berhasil dibuat', color: 'success' });
        // Re-fetch bills for this room 
        await openDetails(room);
        await kosStore.fetchReminders();
    } catch (err: any) {
        const msg = err?.data?.message || err?.message || 'Gagal membuat tagihan sewa';
        toast.add({ title: 'Error', description: msg, color: 'error' });
    } finally {
        isGenerating.value = false;
    }
};

// WhatsApp
const sendingWa = ref<string | null>(null);
const { buildMessage, getDefaultTemplate, openWhatsApp } = useWhatsAppTemplate();

const sendWhatsApp = async (room: any) => {
    const phone = room.tenant?.contact || room.tenantContact;
    if (!phone) {
        toast.add({ title: 'Error', description: 'Nomor kontak tidak tersedia', color: 'error' });
        return;
    }

    sendingWa.value = room.id;
    let invoiceLinks: string[] = [];

    // Generate links for unpaid bills
    const unpaidBills: any[] = [];
    for (const r of roomRentBills.value) {
        if (!r.bill?.isPaid) unpaidBills.push({ id: r.bill.id, type: 'rent', ...r.bill });
    }
    for (const u of roomUtilityBills.value) {
        if (!u.bill?.isPaid) unpaidBills.push({ id: u.bill.id, type: 'utility', ...u.bill });
    }

    try {
        for (const bill of unpaidBills) {
            const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
                `/api/bills/public-link/${bill.id}`,
                { method: 'POST', body: { billType: bill.type } }
            );
            if (linkResponse.publicUrl) invoiceLinks.push(linkResponse.publicUrl);
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
        invoiceUrl: invoiceLinks.length > 0
            ? invoiceLinks.map((link, i) => `Tagihan ${i+1}: ${link}`).join('\n')
            : undefined
    };

    const message = buildMessage(template.message, billingData);
    sendingWa.value = null;
    openWhatsApp(phone, message);
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
        <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" :loading="isLoading || remindersLoading" @click="refreshAll">
            Refresh
        </UButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && paginatedRooms.length === 0" class="py-12 flex justify-center">
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
                            'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400': getRoomStatus(room.id).status === 'belum_ada',
                          }"
                        >
                            <UIcon 
                              :name="getRoomStatus(room.id).status === 'lunas' ? 'i-heroicons-check-circle' : (getRoomStatus(room.id).status === 'belum_ada' ? 'i-heroicons-document-plus' : (getRoomStatus(room.id).daysUntilDue !== null && getRoomStatus(room.id).daysUntilDue! < 0 ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-clock'))" 
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
                                 <!-- Belum Ada Tagihan Badge -->
                                 <UBadge v-else color="neutral" variant="subtle" size="xs">
                                    Belum Ada Tagihan
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
                <!-- Rent Bill Section -->
                <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold uppercase text-gray-500">Tagihan Sewa</span>
                        <template v-if="roomRentBills.length > 0">
                            <span class="text-xs text-gray-500">{{ formatPeriodMonth(roomRentBills[0].bill.period) }}</span>
                        </template>
                    </div>
                    
                    <template v-if="roomRentBills.length > 0">
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(roomRentBills[0].bill.totalAmount) }}</div>
                            </div>
                            <UBadge :color="roomRentBills[0].bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                                {{ roomRentBills[0].bill.isPaid ? 'Lunas' : 'Belum Lunas' }}
                            </UBadge>
                        </div>
                    </template>
                    <template v-else>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-500">Belum ada tagihan sewa</span>
                            <UButton 
                                size="xs" 
                                color="primary" 
                                variant="soft"
                                icon="i-heroicons-plus"
                                :loading="isGenerating"
                                @click="generateRentBill"
                            >
                                Buat Tagihan
                            </UButton>
                        </div>
                    </template>
                </div>

                <!-- Utility Bill Section -->
                <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold uppercase text-gray-500">Tagihan Utilitas</span>
                        <template v-if="roomUtilityBills.length > 0">
                            <span class="text-xs text-gray-500">{{ formatPeriodMonth(roomUtilityBills[0].bill.period) }}</span>
                        </template>
                    </div>
                    
                    <template v-if="roomUtilityBills.length > 0">
                        <div class="space-y-1 text-sm mb-2">
                            <div class="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Listrik</span>
                                <span>{{ formatCurrency(roomUtilityBills[0].bill.usageCost || 0) }}</span>
                            </div>
                            <div class="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Air</span>
                                <span>{{ formatCurrency(roomUtilityBills[0].bill.waterFee || 0) }}</span>
                            </div>
                            <div v-if="Number(roomUtilityBills[0].bill.trashFee) > 0" class="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Sampah</span>
                                <span>{{ formatCurrency(roomUtilityBills[0].bill.trashFee) }}</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div class="font-semibold text-gray-900 dark:text-white">{{ formatCurrency(roomUtilityBills[0].bill.totalAmount) }}</div>
                            <UBadge :color="roomUtilityBills[0].bill.isPaid ? 'success' : 'warning'" variant="subtle" size="xs">
                                {{ roomUtilityBills[0].bill.isPaid ? 'Lunas' : 'Belum Lunas' }}
                            </UBadge>
                        </div>
                    </template>
                    <template v-else>
                        <span class="text-sm text-gray-500">Belum ada tagihan utilitas. Catat meter terlebih dahulu.</span>
                    </template>
                </div>

                <!-- Grand Total -->
                <div v-if="hasAnyBills" class="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>Total</span>
                    <span>{{ formatCurrency(
                        (roomRentBills.length > 0 && !roomRentBills[0].bill.isPaid ? Number(roomRentBills[0].bill.totalAmount) : 0) +
                        (roomUtilityBills.length > 0 && !roomUtilityBills[0].bill.isPaid ? Number(roomUtilityBills[0].bill.totalAmount) : 0)
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
  </div>
</template>
