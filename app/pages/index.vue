<script setup lang="ts">
import { useKosStore } from '~/stores/kos';

const kosStore = useKosStore();

// Check authentication from API (cookie-based)
const { data: authData, error } = await useFetch('/api/auth/me');

if (error.value || !authData.value) {
  await navigateTo('/login');
}

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
      <p class="text-gray-600 dark:text-gray-400">Welcome back, here's what's happening today.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-primary-500" />
            <h3 class="font-semibold">Properties</h3>
          </div>
        </template>
        <div class="text-3xl font-bold">{{ totalProperties }}</div>
        <p class="text-sm text-gray-500">Total Managed</p>
      </UCard>

      <UCard>
        <template #header>
           <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-home" class="w-5 h-5 text-blue-500" />
            <h3 class="font-semibold">Total Rooms</h3>
           </div>
        </template>
        <div class="text-3xl font-bold">{{ totalRooms }}</div>
        <p class="text-sm text-gray-500">Across all properties</p>
      </UCard>

      <UCard>
        <template #header>
           <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="w-5 h-5 text-green-500" />
            <h3 class="font-semibold">Active Tenants</h3>
           </div>
        </template>
        <div class="text-3xl font-bold">{{ totalTenants }}</div>
        <p class="text-sm text-gray-500">Currently renting</p>
      </UCard>

       <UCard>
        <template #header>
           <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-chart-pie" class="w-5 h-5 text-orange-500" />
            <h3 class="font-semibold">Occupancy</h3>
           </div>
        </template>
        <div class="text-3xl font-bold">{{ Math.round((occupiedRooms / totalRooms) * 100) || 0 }}%</div>
        <p class="text-sm text-gray-500">Occupancy Rate</p>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <UCard>
        <template #header>
          <h3 class="font-semibold">Quick Actions</h3>
        </template>
        <div class="grid grid-cols-2 gap-4">
           <UButton to="/properties" icon="i-heroicons-building-office-2" block variant="soft">Manage Properties</UButton>
           <UButton to="/tenants" icon="i-heroicons-users" block variant="soft">Manage Tenants</UButton>
           <UButton to="/billing" icon="i-heroicons-banknotes" block variant="soft">Create Bill</UButton>
           <UButton to="/settings" icon="i-heroicons-cog-6-tooth" block variant="soft">Global Settings</UButton>
        </div>
      </UCard>
       <UCard>
        <template #header>
          <h3 class="font-semibold">Recent Activity</h3>
        </template>
        <div class="text-sm text-gray-500 text-center py-8">
          No recent activity to show.
        </div>
      </UCard>
    </div>
  </div>
</template>
