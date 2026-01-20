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
      color: 'green',
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
      color: 'red',
    })
  }
}

// User menu actions
const handleUserAction = (action: string) => {
  console.log('User action:', action) // Debug log
  switch (action) {
    case 'profile':
      router.push('/examples/profile')
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
        <span class="hidden lg:inline text-sm text-gray-500">Search...</span>
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
                <UBadge v-if="reminders.counts.overdue > 0" color="red" variant="subtle">
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
    <UModal v-model:open="searchOpen">
      <template #content>
        <div class="p-4">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="Search components, pages..."
            size="lg"
            autofocus
          />
          
          <div class="mt-4">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Links</p>
            <div class="space-y-1">
              <NuxtLink
                v-for="link in [
                  { label: 'Button', to: '/components/elements/button' },
                  { label: 'Input', to: '/components/forms/input' },
                  { label: 'Table', to: '/components/data/table' },
                  { label: 'Modal', to: '/components/overlays/modal' }
                ]"
                :key="link.to"
                :to="link.to"
                class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                @click="searchOpen = false"
              >
                <UIcon name="i-heroicons-cube" class="w-4 h-4 text-gray-400" />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ link.label }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
