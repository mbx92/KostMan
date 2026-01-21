<script setup lang="ts">
import { useKosStore } from '~/stores/kos';
import { storeToRefs } from 'pinia';

const kosStore = useKosStore();
const { reminders, remindersLoading, remindersError, properties } = storeToRefs(kosStore);
const toast = useToast();
const router = useRouter();

onMounted(async () => {
    await Promise.all([
        kosStore.fetchReminders(),
        kosStore.fetchProperties()
    ]);
});

// Filters
const searchQuery = ref('');
const selectedPropertyId = ref('all');

const propertyItems = computed(() => [
    { label: 'Semua Properti', value: 'all' },
    ...properties.value.map(p => ({ label: p.name, value: p.id }))
]);

// Collapsible sections
const collapsed = reactive({
    overdue: false,
    dueSoon: false,
    upcoming: false
});

const toggleCollapse = (section: 'overdue' | 'dueSoon' | 'upcoming') => {
    collapsed[section] = !collapsed[section];
};

// Limits for pagination
const limits = reactive({
    overdue: 5,
    dueSoon: 5,
    upcoming: 5
});

const loadingMore = reactive({
    overdue: false,
    dueSoon: false,
    upcoming: false
});

const loadMore = async (section: 'overdue' | 'dueSoon' | 'upcoming') => {
    loadingMore[section] = true;
    // Simulate loading delay for smooth UX
    await new Promise(resolve => setTimeout(resolve, 300));
    limits[section] += 5;
    loadingMore[section] = false;
};

const resetLimit = (section: 'overdue' | 'dueSoon' | 'upcoming') => {
    limits[section] = 5;
};

// Filtered & Grouped Data
const groupBills = (bills: any[]) => {
    const groups: { [key: string]: any } = {};
    
    bills.forEach(bill => {
        const key = `${bill.tenantId}-${bill.roomId}`; // Group by Tenant+Room
        if (!groups[key]) {
            groups[key] = {
                id: key,
                tenantId: bill.tenantId,
                tenantName: bill.tenantName,
                tenantContact: bill.tenantContact,
                roomId: bill.roomId,
                roomName: bill.roomName,
                propertyName: bill.propertyName,
                propertyId: bill.propertyId, // Added for filtering
                occupantCount: bill.occupantCount,
                bills: [],
                totalAmount: 0,
                daysUntilDue: bill.daysUntilDue, // Take the first one found (usually most urgent if sorted)
                dueDate: bill.dueDate
            };
        }
        groups[key].bills.push(bill);
        groups[key].totalAmount += Number(bill.amount);
        // Keep the most urgent due date/days
        if (bill.daysUntilDue < groups[key].daysUntilDue) {
             groups[key].daysUntilDue = bill.daysUntilDue;
             groups[key].dueDate = bill.dueDate;
        }
    });

    return Object.values(groups);
};

const filteredReminders = computed(() => {
    const query = searchQuery.value.toLowerCase();
    const propId = selectedPropertyId.value;

    const filterFn = (bill: any) => {
        const matchesSearch = 
            bill.tenantName?.toLowerCase().includes(query) || 
            bill.roomName?.toLowerCase().includes(query);
            
        // Robust property check using ID if available, falling back to all
        const matchesProperty = propId === 'all' || bill.propertyId === propId;
        
        return matchesSearch && matchesProperty;
    };

    const filteredOverdue = reminders.value.overdue.filter(filterFn);
    const filteredDueSoon = reminders.value.dueSoon.filter(filterFn);
    const filteredUpcoming = reminders.value.upcoming.filter(filterFn);

    return {
        overdue: groupBills(filteredOverdue),
        dueSoon: groupBills(filteredDueSoon),
        upcoming: groupBills(filteredUpcoming),
    };
});

const displayCounts = computed(() => ({
    overdue: filteredReminders.value.overdue.length,
    dueSoon: filteredReminders.value.dueSoon.length,
    upcoming: filteredReminders.value.upcoming.length,
    total: filteredReminders.value.overdue.length + filteredReminders.value.dueSoon.length + filteredReminders.value.upcoming.length
}));


// Format currency
const formatCurrency = (amount: number | string) => {
    return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

// Format date relative
const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

const sendingWa = ref<string | null>(null);
const { buildMessage, getDefaultTemplate, openWhatsApp } = useWhatsAppTemplate();

const sendWhatsApp = async (group: any) => {
    const phone = group.tenantContact;
    if (!phone) {
         toast.add({ title: 'Error', description: 'Nomor kontak tidak tersedia', color: 'error' });
         return;
    }

    sendingWa.value = group.id;
    let invoiceLinks: string[] = [];

    try {
        for (const bill of group.bills) {
            const linkResponse = await $fetch<{ token: string; publicUrl: string }>(
                `/api/bills/public-link/${bill.id}`,
                {
                    method: 'POST',
                    body: { billType: bill.type }, 
                }
            );
            if (linkResponse.publicUrl) {
                invoiceLinks.push(linkResponse.publicUrl);
            }
        }
    } catch (e: any) {
        console.error('Failed to generate link', e);
         toast.add({
            title: "Error",
            description: "Gagal generate link invoice untuk beberapa tagihan",
            color: "warning",
        });
    }

    // Calculate totals for template
    let rentTotal = 0;
    let utilityTotal = 0;
    let rentBill: any = null;
    let utilBill: any = null;
    
    for (const bill of group.bills) {
        if (bill.type === 'rent') {
            rentTotal += Number(bill.amount);
            rentBill = bill;
        } else if (bill.type === 'utility') {
            utilityTotal += Number(bill.amount);
            utilBill = bill;
        }
    }

    // Determine template type based on reminder urgency
    const templateType = group.daysUntilDue < 0 ? 'reminder_overdue' : 'reminder_due_soon';
    
    // Get template from database
    const template = await getDefaultTemplate(templateType);
    
    // Build billing data for template
    const billingData = {
        tenantName: group.tenantName,
        propertyName: group.propertyName,
        roomName: group.roomName,
        period: group.bills[0]?.period || 'N/A',
        occupantCount: group.occupantCount || 1,
        daysUntilDue: group.daysUntilDue,
        
        // Rent details
        rentAmount: rentTotal,
        monthsCovered: rentBill?.monthsCovered || 1,
        roomPrice: rentBill?.roomPrice || 0,
        isRentPaid: false,
        
        // Utility details
        meterStart: utilBill?.meterStart,
        meterEnd: utilBill?.meterEnd,
        usageCost: utilBill?.usageCost || 0,
        waterFee: utilBill?.waterFee || 0,
        trashFee: utilBill?.trashFee || 0,
        utilityTotal: utilityTotal,
        isUtilityPaid: false,
        
        // Grand total
        grandTotal: group.totalAmount,
        
        // Invoice link
        invoiceUrl: invoiceLinks.length > 0 
            ? invoiceLinks.map((link, i) => `Tagihan ${i+1}: ${link}`).join('\n')
            : undefined
    };

    // Build message using template
    const message = buildMessage(template.message, billingData);

    sendingWa.value = null;
    openWhatsApp(phone, message);
}

// Details Modal
const showDetails = ref(false);
const selectedGroup = ref<any>(null);

const openDetails = (group: any) => {
    selectedGroup.value = group;
    showDetails.value = true;
};
</script>

<template>
  <div class="p-8">
    <!-- Header with Search & Filter -->
    <div class="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Pengingat Tagihan</h1>
        <p class="text-gray-600 dark:text-gray-400">Kelola tagihan belum lunas dan kirim pengingat.</p>
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
        <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" :loading="remindersLoading" @click="kosStore.fetchReminders()">
            Refresh
        </UButton>
      </div>
    </div>

    <div v-if="remindersLoading && !displayCounts.total" class="py-12 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
    </div>

    <!-- Error State -->
    <UAlert v-else-if="remindersError" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" title="Error fetching reminders" :description="remindersError" />

    <!-- Empty State -->
    <div v-else-if="displayCounts.total === 0" class="py-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
       <UIcon name="i-heroicons-check-circle" class="w-16 h-16 text-green-500 mx-auto mb-4" />
       <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Semua Beres!</h3>
       <p class="text-gray-500">Tidak ada tagihan belum lunas yang sesuai filter.</p>
    </div>

    <div v-else class="space-y-8">
      
      <!-- Overdue Section -->
      <section v-if="filteredReminders.overdue.length > 0">
        <div 
          class="flex items-center gap-2 mb-4 cursor-pointer select-none"
          @click="toggleCollapse('overdue')"
        >
           <div class="w-2 h-8 bg-red-500 rounded-full"></div>
           <h2 class="text-xl font-bold text-red-600 dark:text-red-400">Lewat Jatuh Tempo ({{ filteredReminders.overdue.length }})</h2>
           <UIcon 
             :name="collapsed.overdue ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" 
             class="w-5 h-5 text-gray-400 transition-transform"
           />
        </div>
        
        <div v-show="!collapsed.overdue" class="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/30 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden">
            <div 
                v-for="group in filteredReminders.overdue.slice(0, limits.overdue)" 
                :key="group.id" 
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                @click="openDetails(group)"
            >
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="bg-red-100 dark:bg-red-900/20 p-2 rounded-lg text-red-600 dark:text-red-400 shrink-0 flex items-center justify-center">
                            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ group.tenantName }}</h4>
                            <p class="text-sm text-gray-500 truncate">{{ group.roomName }} • {{ group.propertyName }}</p>
                            <div class="mt-1 flex items-center gap-2 flex-wrap">
                                 <UBadge color="red" variant="subtle" size="xs">
                                    Lewat {{ Math.abs(group.daysUntilDue) }} hari
                                 </UBadge>
                                 <span class="text-xs text-gray-400 hidden sm:inline">Sejak: {{ formatDate(group.dueDate) }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <div class="text-right hidden sm:block">
                            <div class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(group.totalAmount) }}</div>
                            <div class="text-xs text-gray-500 uppercase">{{ group.bills.length }} Tagihan</div>
                        </div>
                        <div class="text-right sm:hidden">
                            <div class="text-sm font-bold text-gray-900 dark:text-white">{{ formatCurrency(group.totalAmount) }}</div>
                        </div>
                        <UButton 
                            icon="i-simple-icons-whatsapp" 
                            size="md"
                            class="bg-[#25D366] hover:bg-[#128C7E] text-white"
                            :loading="sendingWa === group.id"
                            @click.stop="sendWhatsApp(group)"
                        />
                    </div>
                </div>
            </div>
            <!-- Loading Skeleton -->
            <div v-if="loadingMore.overdue" class="p-4 space-y-3">
                <div class="animate-pulse flex items-center gap-3">
                    <div class="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
            <!-- Show More / Show Less -->
            <div v-if="filteredReminders.overdue.length > 5 && !loadingMore.overdue" class="p-2 bg-gray-50 dark:bg-gray-800/30 flex justify-center gap-4">
                <span 
                    v-if="limits.overdue < filteredReminders.overdue.length"
                    class="text-sm text-primary-600 dark:text-primary-400 font-medium select-none cursor-pointer hover:underline"
                    @click="loadMore('overdue')"
                >
                    Lebih Banyak
                </span>
                <span 
                    v-if="limits.overdue > 5"
                    class="text-sm text-gray-500 dark:text-gray-400 font-medium select-none cursor-pointer hover:underline"
                    @click="resetLimit('overdue')"
                >
                    Tampilkan Lebih Sedikit
                </span>
            </div>
        </div>
      </section>

      <!-- Due Soon Section -->
      <section v-if="filteredReminders.dueSoon.length > 0">
        <div 
          class="flex items-center gap-2 mb-4 cursor-pointer select-none"
          @click="toggleCollapse('dueSoon')"
        >
           <div class="w-2 h-8 bg-orange-500 rounded-full"></div>
           <h2 class="text-xl font-bold text-orange-600 dark:text-orange-400">Segera Jatuh Tempo ({{ filteredReminders.dueSoon.length }})</h2>
           <UIcon 
             :name="collapsed.dueSoon ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" 
             class="w-5 h-5 text-gray-400 transition-transform"
           />
        </div>
        
        <div v-show="!collapsed.dueSoon" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden">
            <div 
                v-for="group in filteredReminders.dueSoon.slice(0, limits.dueSoon)" 
                :key="group.id" 
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                @click="openDetails(group)"
            >
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-lg text-orange-600 dark:text-orange-400 shrink-0 flex items-center justify-center">
                            <UIcon name="i-heroicons-clock" class="w-5 h-5" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ group.tenantName }}</h4>
                            <p class="text-sm text-gray-500 truncate">{{ group.roomName }} • {{ group.propertyName }}</p>
                            <div class="mt-1 flex items-center gap-2 flex-wrap">
                                 <UBadge color="orange" variant="subtle" size="xs">
                                    <template v-if="group.daysUntilDue < 0">
                                        Lewat {{ Math.abs(group.daysUntilDue) }} hari
                                    </template>
                                    <template v-else-if="group.daysUntilDue === 0">
                                        Jatuh tempo hari ini
                                    </template>
                                    <template v-else>
                                        Jatuh tempo dalam {{ group.daysUntilDue }} hari
                                    </template>
                                 </UBadge>
                                 <span class="text-xs text-gray-400 hidden sm:inline">Jatuh tempo: {{ formatDate(group.dueDate) }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <div class="text-right hidden sm:block">
                            <div class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(group.totalAmount) }}</div>
                            <div class="text-xs text-gray-500 uppercase">{{ group.bills.length }} Tagihan</div>
                        </div>
                        <div class="text-right sm:hidden">
                            <div class="text-sm font-bold text-gray-900 dark:text-white">{{ formatCurrency(group.totalAmount) }}</div>
                        </div>
                        <UButton 
                            icon="i-simple-icons-whatsapp" 
                            size="md"
                            class="bg-[#25D366] hover:bg-[#128C7E] text-white"
                            :loading="sendingWa === group.id"
                            @click.stop="sendWhatsApp(group)"
                        />
                    </div>
                </div>
            </div>
             <!-- Loading Skeleton -->
            <div v-if="loadingMore.dueSoon" class="p-4 space-y-3">
                <div class="animate-pulse flex items-center gap-3">
                    <div class="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
            <!-- Show More / Show Less -->
            <div v-if="filteredReminders.dueSoon.length > 5 && !loadingMore.dueSoon" class="p-2 bg-gray-50 dark:bg-gray-800/30 flex justify-center gap-4">
                <span 
                    v-if="limits.dueSoon < filteredReminders.dueSoon.length"
                    class="text-sm text-primary-600 dark:text-primary-400 font-medium select-none cursor-pointer hover:underline"
                    @click="loadMore('dueSoon')"
                >
                    Lebih Banyak
                </span>
                <span 
                    v-if="limits.dueSoon > 5"
                    class="text-sm text-gray-500 dark:text-gray-400 font-medium select-none cursor-pointer hover:underline"
                    @click="resetLimit('dueSoon')"
                >
                    Tampilkan Lebih Sedikit
                </span>
            </div>
        </div>
      </section>

      <!-- Upcoming Section -->
      <section v-if="filteredReminders.upcoming.length > 0">
        <div 
          class="flex items-center gap-2 mb-4 cursor-pointer select-none"
          @click="toggleCollapse('upcoming')"
        >
           <div class="w-2 h-8 bg-gray-500 rounded-full"></div>
           <h2 class="text-xl font-bold text-gray-600 dark:text-gray-400">Mendatang ({{ filteredReminders.upcoming.length }})</h2>
           <UIcon 
             :name="collapsed.upcoming ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" 
             class="w-5 h-5 text-gray-400 transition-transform"
           />
        </div>
        
        <div v-show="!collapsed.upcoming" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow-sm overflow-hidden">
            <div 
                v-for="group in filteredReminders.upcoming.slice(0, limits.upcoming)" 
                :key="group.id" 
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                @click="openDetails(group)"
            >
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-gray-600 dark:text-gray-400 shrink-0 flex items-center justify-center">
                            <UIcon name="i-heroicons-calendar" class="w-5 h-5" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="font-semibold text-gray-900 dark:text-white truncate">{{ group.tenantName }}</h4>
                            <p class="text-sm text-gray-500 truncate">{{ group.roomName }} • {{ group.propertyName }}</p>
                            <div class="mt-1 flex items-center gap-2 flex-wrap">
                                 <UBadge color="gray" variant="subtle" size="xs">
                                    {{ group.daysUntilDue }} hari lagi
                                 </UBadge>
                                 <span class="text-xs text-gray-400 hidden sm:inline">Jatuh tempo: {{ formatDate(group.dueDate) }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <div class="text-right hidden sm:block">
                            <div class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(group.totalAmount) }}</div>
                            <div class="text-xs text-gray-500 uppercase">{{ group.bills.length }} Tagihan</div>
                        </div>
                        <div class="text-right sm:hidden">
                            <div class="text-sm font-bold text-gray-900 dark:text-white">{{ formatCurrency(group.totalAmount) }}</div>
                        </div>
                        <UButton 
                            icon="i-simple-icons-whatsapp" 
                            size="md"
                            class="bg-[#25D366] hover:bg-[#128C7E] text-white"
                            :loading="sendingWa === group.id"
                            @click.stop="sendWhatsApp(group)"
                        />
                    </div>
                </div>
            </div>
             <!-- Loading Skeleton -->
            <div v-if="loadingMore.upcoming" class="p-4 space-y-3">
                <div class="animate-pulse flex items-center gap-3">
                    <div class="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
            <!-- Show More / Show Less -->
            <div v-if="filteredReminders.upcoming.length > 5 && !loadingMore.upcoming" class="p-2 bg-gray-50 dark:bg-gray-800/30 flex justify-center gap-4">
                <span 
                    v-if="limits.upcoming < filteredReminders.upcoming.length"
                    class="text-sm text-primary-600 dark:text-primary-400 font-medium select-none cursor-pointer hover:underline"
                    @click="loadMore('upcoming')"
                >
                    Lebih Banyak
                </span>
                <span 
                    v-if="limits.upcoming > 5"
                    class="text-sm text-gray-500 dark:text-gray-400 font-medium select-none cursor-pointer hover:underline"
                    @click="resetLimit('upcoming')"
                >
                    Tampilkan Lebih Sedikit
                </span>
            </div>
        </div>
      </section>

    </div>
    
    <!-- Details Modal -->
    <UModal 
      v-model:open="showDetails"
      title="Detail Tagihan"
      :description="selectedGroup ? `${selectedGroup.tenantName} • ${selectedGroup.roomName}` : ''"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div v-if="selectedGroup" class="space-y-4">
            <div v-for="bill in selectedGroup.bills" :key="bill.id" class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                <div class="flex justify-between mb-2">
                    <span class="text-xs font-bold uppercase text-gray-500">Tagihan {{ bill.type === 'rent' ? 'SEWA' : 'UTILITAS' }}</span>
                    <span class="text-xs font-semibold">{{ bill.period }}</span>
                </div>
                
                <!-- Rent Details -->
                <div v-if="bill.type === 'rent'" class="space-y-1 text-sm">
                    <div class="flex justify-between">
                        <span>Harga Kamar (x{{ bill.monthsCovered || 1 }})</span>
                        <span>{{ formatCurrency(bill.roomPrice) }}</span>
                    </div>
                </div>
                
                <!-- Utility Details -->
                <div v-else class="space-y-1 text-sm">
                   <div class="flex justify-between text-gray-600 dark:text-gray-400">
                       <span>Listrik ({{ bill.meterStart }} -> {{ bill.meterEnd }})</span>
                       <span>{{ formatCurrency(bill.usageCost) }}</span>
                   </div>
                   <div class="flex justify-between text-gray-600 dark:text-gray-400">
                       <span>Air</span>
                       <span>{{ formatCurrency(bill.waterFee) }}</span>
                   </div>
                   <div v-if="bill.trashFee > 0" class="flex justify-between text-gray-600 dark:text-gray-400">
                       <span>Sampah</span>
                       <span>{{ formatCurrency(bill.trashFee) }}</span>
                   </div>
                </div>
                
                <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{{ formatCurrency(bill.amount) }}</span>
                </div>
            </div>
             <div class="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Total Keseluruhan</span>
                <span>{{ formatCurrency(selectedGroup.totalAmount) }}</span>
            </div>
        </div>
      </template>

      <template #footer="{ close }">
        <UButton label="Tutup" size="lg" color="neutral" variant="outline" @click="close" />
        <UButton label="Kirim WhatsApp" size="lg" icon="i-simple-icons-whatsapp" class="bg-[#25D366] hover:bg-[#128C7E] text-white" @click="sendWhatsApp(selectedGroup); close()" />
      </template>
    </UModal>
  </div>


</template>
