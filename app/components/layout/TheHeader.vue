<script setup lang="ts">
interface Props {
  colorMode?: string
}

defineProps<Props>()

const emit = defineEmits<{
  toggleSidebar: []
  toggleDesktopSidebar: []
  toggleColorMode: []
}>()

const router = useRouter()
const toast = useToast()

// Fetch current user
const { data: authData, refresh: refreshUser } = await useFetch('/api/auth/me')
const currentUser = computed(() => authData.value?.user)

// Search
const searchOpen = ref(false)
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<{
  tenants: any[]
  rooms: any[]
  properties: any[]
}>({ tenants: [], rooms: [], properties: [] })

// All menu items for filtering
const allMenuItems = [
  { label: 'Dashboard', icon: 'i-heroicons-home', to: '/' },
  { label: 'Properti', icon: 'i-heroicons-building-office-2', to: '/properties' },
  { label: 'Kamar', icon: 'i-heroicons-building-office', to: '/rooms' },
  { label: 'Penghuni', icon: 'i-heroicons-users', to: '/tenants' },
  { label: 'Tagihan', icon: 'i-heroicons-document-text', to: '/billing' },
  { label: 'Catat Meter', icon: 'i-heroicons-bolt', to: '/meter-readings' },
  { label: 'Pengingat', icon: 'i-heroicons-bell', to: '/reminders' },
  { label: 'Laporan Listrik', icon: 'i-heroicons-chart-bar', to: '/reports/electricity' },
  { label: 'Laporan Penghuni', icon: 'i-heroicons-user-group', to: '/reports/tenants' },
  { label: 'Laporan Pembayaran', icon: 'i-heroicons-banknotes', to: '/reports/payments' },
  { label: 'Laporan Pendapatan', icon: 'i-heroicons-currency-dollar', to: '/reports/income' },
  { label: 'Laporan Kas', icon: 'i-heroicons-calculator', to: '/reports/cash' },
  { label: 'Pengaturan', icon: 'i-heroicons-cog-6-tooth', to: '/settings' }
]

// Filtered menus based on search query
const filteredMenus = computed(() => {
  if (!searchQuery.value.trim()) return allMenuItems.slice(0, 6) // Show first 6 if no query
  const q = searchQuery.value.toLowerCase()
  return allMenuItems.filter(m => m.label.toLowerCase().includes(q))
})

// Debounced search function
let searchTimeout: NodeJS.Timeout | null = null
const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  
  if (!searchQuery.value.trim() || searchQuery.value.length < 2) {
    searchResults.value = { tenants: [], rooms: [], properties: [] }
    return
  }
  
  searchTimeout = setTimeout(async () => {
    isSearching.value = true
    try {
      const results = await $fetch('/api/search', {
        query: { q: searchQuery.value }
      })
      searchResults.value = results as any
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      isSearching.value = false
    }
  }, 300)
}

// Watch search query
watch(searchQuery, debouncedSearch)

// Reset search when modal closes
watch(searchOpen, (open) => {
  if (!open) {
    searchQuery.value = ''
    searchResults.value = { tenants: [], rooms: [], properties: [] }
  }
})

// Navigate to result
const goToResult = (type: string, id: string) => {
  searchOpen.value = false
  switch (type) {
    case 'tenant':
      router.push(`/tenants/${id}`)
      break
    case 'room':
      router.push(`/rooms/${id}`)
      break
    case 'property':
      router.push(`/properties/${id}`)
      break
  }
}

// Check if has any search results
const hasResults = computed(() => {
  return searchResults.value.tenants.length > 0 || 
         searchResults.value.rooms.length > 0 || 
         searchResults.value.properties.length > 0
})

// Bill Reminders
import { useKosStore } from '~/stores/kos';
import { storeToRefs } from 'pinia';
const kosStore = useKosStore();
const { reminders } = storeToRefs(kosStore);

onMounted(() => {
    // Initial fetch
    kosStore.fetchReminders();
});



// Logout handler
const handleLogout = async () => {
  console.log('Logout clicked') // Debug log
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    toast.add({
      title: 'Logged out successfully',
      color: 'success',
    })
    // Force page reload to clear all state and redirect
    if (process.client) {
      window.location.href = '/login'
    }
  } catch (error: any) {
    console.error('Logout error:', error) // Debug log
    toast.add({
      title: 'Logout failed',
      description: error.message,
      color: 'error',
    })
  }
}

// User menu actions
const handleUserAction = (action: string) => {
  console.log('User action:', action) // Debug log
  switch (action) {
    case 'profile':
      router.push('/account')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      handleLogout()
      break
  }
}

// User dropdown items
const userItems = [
  [
    {
      label: 'Profile',
      icon: 'i-heroicons-user',
      click: () => handleUserAction('profile')
    },
    {
      label: 'Settings',
      icon: 'i-heroicons-cog-6-tooth',
      click: () => handleUserAction('settings')
    }
  ],
  [
    {
      label: 'Keluar',
      icon: 'i-heroicons-arrow-right-on-rectangle',
      click: () => handleUserAction('logout')
    }
  ]
]

// Keyboard shortcut for search
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchOpen.value = true
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <div class="h-full px-4 flex items-center justify-between gap-4">
    <!-- Left section -->
    <div class="flex items-center gap-4">
      <!-- Desktop sidebar toggle -->
      <UButton
        icon="i-heroicons-bars-3"
        variant="ghost"
        color="neutral"
        class="hidden lg:flex"
        @click="emit('toggleDesktopSidebar')"
      />

      <!-- Mobile menu toggle -->
      <UButton
        icon="i-heroicons-bars-3"
        variant="ghost"
        color="neutral"
        class="lg:hidden"
        @click="emit('toggleSidebar')"
      />

      <!-- Breadcrumb -->
      <div class="hidden md:flex items-center gap-2 text-sm">
        <UIcon name="i-heroicons-home" class="w-4 h-4 text-gray-500" />
        <span class="text-gray-500">/</span>
        <span class="text-gray-900 dark:text-white">Dashboard</span>
      </div>
    </div>

    <!-- Right section -->
    <div class="flex items-center gap-2">
      <!-- Search button -->
      <UButton
        icon="i-heroicons-magnifying-glass"
        variant="ghost"
        color="neutral"
        class="hidden sm:flex"
        @click="searchOpen = true"
      >
        <span class="hidden lg:inline text-sm text-gray-500">Cari...</span>
        <UKbd class="hidden lg:inline ml-2">⌘K</UKbd>
      </UButton>

      <!-- Color mode toggle -->
      <ClientOnly>
        <UButton
          :icon="colorMode === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          variant="ghost"
          color="neutral"
          @click="emit('toggleColorMode')"
        />
        <template #fallback>
          <UButton
            icon="i-heroicons-moon"
            variant="ghost"
            color="neutral"
            disabled
          />
        </template>
      </ClientOnly>

      <!-- Notifications -->
      <UPopover :mode="'hover'">
        <UButton
          icon="i-heroicons-bell"
          variant="ghost"
          color="neutral"
          class="relative"
          to="/reminders"
        >
          <span
            v-if="reminders.counts.overdue > 0"
            class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
          />
        </UButton>

        <template #content>
          <div class="w-80">
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <UBadge v-if="reminders.counts.overdue > 0" color="error" variant="subtle">
                  {{ reminders.counts.overdue }} Overdue
                </UBadge>
              </div>
            </div>
            
            <div class="max-h-80 overflow-y-auto">
              <!-- Overdue Bills (High Priority) -->
              <div
                v-for="bill in reminders.overdue.slice(0, 3)"
                :key="'overdue-'+bill.id"
                class="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors border-l-4 border-red-500"
                @click="router.push('/reminders')"
              >
                <div class="flex items-start gap-3">
                  <div class="shrink-0">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
                      <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      Tagihan Jatuh Tempo
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {{ bill.tenantName }} ({{ bill.roomName }})
                    </p>
                    <p class="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                      Due {{ Math.abs(bill.daysUntilDue) }} days ago
                    </p>
                  </div>
                </div>
              </div>

            <!-- Empty State if no reminders -->
            <div v-if="reminders.overdue.length === 0" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
               <p class="text-sm">No new notifications</p>
            </div>
            </div>

            <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <UButton variant="ghost" color="primary" block size="sm" to="/reminders">
                View all notifications
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- User dropdown -->
      <UPopover :popper="{ placement: 'bottom-end' }">
        <UButton variant="ghost" color="neutral" class="gap-2" trailing-icon="i-heroicons-chevron-down">
          <UAvatar
            :alt="currentUser?.name"
            size="xs"
            class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200"
          >
            <template v-if="currentUser?.name">
              {{ currentUser.name.charAt(0).toUpperCase() }}
            </template>
            <template v-else>
              <UIcon name="i-heroicons-user" />
            </template>
          </UAvatar>
          <span class="hidden lg:inline text-sm">{{ currentUser?.name || 'User' }}</span>
          <UBadge v-if="currentUser?.role" color="primary" variant="subtle" size="xs" class="hidden xl:inline">
            {{ currentUser.role }}
          </UBadge>
        </UButton>

        <template #content>
          <div class="w-56 p-1">
            <!-- Profile -->
            <button
              @click="handleUserAction('profile')"
              class="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <UIcon name="i-heroicons-user" class="w-4 h-4 text-gray-500" />
              <span class="text-gray-700 dark:text-gray-300">Profile</span>
            </button>

            <!-- Settings -->
            <button
              @click="handleUserAction('settings')"
              class="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4 text-gray-500" />
              <span class="text-gray-700 dark:text-gray-300">Settings</span>
            </button>

            <div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>

            <!-- Logout -->
            <button
              @click="handleUserAction('logout')"
              class="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
            >
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4 text-red-500" />
              <span class="text-red-600 dark:text-red-400">Keluar</span>
            </button>
          </div>
        </template>
      </UPopover>
    </div>

    <!-- Search Modal -->
    <UModal v-model:open="searchOpen" :title="'Pencarian'" :description="'Cari menu, penghuni, kamar, atau properti'">
      <template #content>
        <div class="p-4 max-h-[70vh] overflow-y-auto">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="Cari menu, penghuni, kamar..."
            size="lg"
            class="w-full"
            autofocus
          />
          
          <!-- Loading State -->
          <div v-if="isSearching" class="mt-4 flex items-center justify-center py-4">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-gray-400" />
            <span class="ml-2 text-sm text-gray-500">Mencari...</span>
          </div>
          
          <!-- Search Results from Database -->
          <div v-else-if="hasResults" class="mt-4 space-y-4">
            <!-- Tenants Results -->
            <div v-if="searchResults.tenants.length > 0">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-medium">Penghuni</p>
              <div class="space-y-1">
                <button
                  v-for="tenant in searchResults.tenants"
                  :key="tenant.id"
                  class="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                  @click="goToResult('tenant', tenant.id)"
                >
                  <UIcon name="i-heroicons-user" class="w-4 h-4 text-blue-500" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ tenant.name }}</div>
                    <div class="text-xs text-gray-500 truncate">{{ tenant.roomName }} • {{ tenant.propertyName }}</div>
                  </div>
                </button>
              </div>
            </div>
            
            <!-- Rooms Results -->
            <div v-if="searchResults.rooms.length > 0">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-medium">Kamar</p>
              <div class="space-y-1">
                <button
                  v-for="room in searchResults.rooms"
                  :key="room.id"
                  class="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                  @click="goToResult('room', room.id)"
                >
                  <UIcon name="i-heroicons-building-office" class="w-4 h-4 text-green-500" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ room.name }}</div>
                    <div class="text-xs text-gray-500 truncate">
                      {{ room.propertyName }}
                      <span v-if="room.tenantName"> • {{ room.tenantName }}</span>
                    </div>
                  </div>
                  <UBadge 
                    :color="room.status === 'occupied' ? 'success' : room.status === 'available' ? 'info' : 'warning'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ room.status === 'occupied' ? 'Terisi' : room.status === 'available' ? 'Tersedia' : 'Maintenance' }}
                  </UBadge>
                </button>
              </div>
            </div>
            
            <!-- Properties Results -->
            <div v-if="searchResults.properties.length > 0">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-medium">Properti</p>
              <div class="space-y-1">
                <button
                  v-for="property in searchResults.properties"
                  :key="property.id"
                  class="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                  @click="goToResult('property', property.id)"
                >
                  <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-purple-500" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ property.name }}</div>
                    <div class="text-xs text-gray-500 truncate">{{ property.address }}</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Filtered Menu Links -->
          <div v-if="filteredMenus.length > 0 && !isSearching" class="mt-4">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-medium">
              {{ searchQuery.trim() ? 'Menu' : 'Akses Cepat' }}
            </p>
            <div class="space-y-1">
              <NuxtLink
                v-for="link in filteredMenus"
                :key="link.to"
                :to="link.to"
                class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                @click="searchOpen = false"
              >
                <UIcon :name="link.icon" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ link.label }}</span>
              </NuxtLink>
            </div>
          </div>
          
          <!-- No Results -->
          <div v-if="searchQuery.trim().length >= 2 && !isSearching && !hasResults && filteredMenus.length === 0" class="mt-4 py-8 text-center">
            <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p class="text-sm text-gray-500">Tidak ada hasil untuk "{{ searchQuery }}"</p>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
