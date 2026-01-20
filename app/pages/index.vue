<script setup lang="ts">
import { useKosStore } from '~/stores/kos';
import { storeToRefs } from 'pinia';

const kosStore = useKosStore();
const { reminders } = storeToRefs(kosStore);

// Check authentication from API (cookie-based)
const { data: authData, error } = await useFetch('/api/auth/me');

if (error.value || !authData.value) {
  await navigateTo('/login');
}

// Fetch data on mount
onMounted(async () => {
  await Promise.all([
    kosStore.fetchProperties(),
    kosStore.fetchRooms({ pageSize: 1000 }),
    kosStore.fetchTenants(),
    kosStore.fetchReminders()
  ])
})

// Summary Data
const totalProperties = computed(() => kosStore.properties.length);
const totalRooms = computed(() => kosStore.rooms.length);
const occupiedRooms = computed(() => kosStore.rooms.filter(r => r.status === 'occupied').length);
const totalTenants = computed(() => kosStore.tenants.length);
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-gray-600 dark:text-gray-400">Ringkasan dan informasi penting tentang properti kos Anda.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Overdue Banner -->
      <div v-if="reminders.counts.overdue > 0" class="col-span-full">
         <div class="bg-gray-900 border border-red-500 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-red-500/10">
            <div class="flex items-center gap-4">
               <div class="bg-transparent text-red-500">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8" />
               </div>
               <div>
                  <div class="flex items-center gap-2">
                     <h3 class="text-red-400 font-bold text-lg">Tagihan Terlambat</h3>
                     <UBadge color="red" size="xs" variant="solid">{{ reminders.counts.overdue }}</UBadge>
                  </div>
                  <p class="text-gray-300 text-sm mt-1">{{ reminders.counts.overdue }} tagihan sudah melewati jatuh tempo.</p>
               </div>
            </div>
            <UButton to="/reminders" color="red" variant="solid" size="md" trailing-icon="i-heroicons-arrow-right">
               Lihat Detail
            </UButton>
         </div>
      </div>
      
      <!-- Due Soon Banner -->
      <div v-if="reminders.counts.dueSoon > 0 && reminders.counts.overdue === 0" class="col-span-full">
         <div class="bg-gray-900 border border-orange-500 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-orange-500/10">
            <div class="flex items-center gap-4">
               <div class="bg-transparent text-orange-500">
                  <UIcon name="i-heroicons-bell-alert" class="w-8 h-8" />
               </div>
               <div>
                  <div class="flex items-center gap-2">
                     <h3 class="text-orange-400 font-bold text-lg">Tagihan Segera Jatuh Tempo</h3>
                     <UBadge color="yellow" size="xs" variant="solid">{{ reminders.counts.dueSoon }}</UBadge>
                  </div>
                  <p class="text-gray-300 text-sm mt-1">{{ reminders.counts.dueSoon }} tagihan akan jatuh tempo dalam 3 hari.</p>
               </div>
            </div>
            <UButton to="/reminders" color="yellow" variant="solid" size="md" trailing-icon="i-heroicons-arrow-right">
               Lihat Detail
            </UButton>
         </div>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-primary-500" />
            <h3 class="font-semibold">Properti</h3>
          </div>
        </template>
        <div class="text-3xl font-bold">{{ totalProperties }}</div>
        <p class="text-sm text-gray-500">Total Dikelola</p>
      </UCard>

      <UCard>
        <template #header>
           <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-home" class="w-5 h-5 text-blue-500" />
            <h3 class="font-semibold">Total Kamar</h3>
           </div>
        </template>
        <div class="text-3xl font-bold">{{ totalRooms }}</div>
        <p class="text-sm text-gray-500">Semua Kamar di semua properti</p>
      </UCard>

      <UCard>
        <template #header>
           <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="w-5 h-5 text-green-500" />
            <h3 class="font-semibold">Penghuni Aktif</h3>
           </div>
        </template>
        <div class="text-3xl font-bold">{{ totalTenants }}</div>
        <p class="text-sm text-gray-500">Sedang Menyewa</p>
      </UCard>

       <UCard>
        <template #header>
           <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-chart-pie" class="w-5 h-5 text-orange-500" />
            <h3 class="font-semibold">Tingkat Hunian</h3>
           </div>
        </template>
        <div class="text-3xl font-bold">{{ Math.round((occupiedRooms / totalRooms) * 100) || 0 }}%</div>
        <p class="text-sm text-gray-500">Persentase Terisi</p>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <UCard>
        <template #header>
          <h3 class="font-semibold">Aksi Cepat</h3>
        </template>
        <div class="grid grid-cols-2 gap-4">
           <UButton to="/properties" icon="i-heroicons-building-office-2" block variant="soft">Kelola Properti</UButton>
           <UButton to="/tenants" icon="i-heroicons-users" block variant="soft">Kelola Penghuni</UButton>
           <UButton to="/billing" icon="i-heroicons-banknotes" block variant="soft">Buat Tagihan</UButton>
           <UButton to="/settings" icon="i-heroicons-cog-6-tooth" block variant="soft">Pengaturan Global</UButton>
        </div>
      </UCard>
       <UCard>
        <template #header>
          <h3 class="font-semibold">Aktivitas Terkini</h3>
        </template>
        <div class="text-sm text-gray-500 text-center py-8">
          Tidak ada aktivitas terkini untuk ditampilkan.
        </div>
      </UCard>
    </div>
  </div>
</template>
