<script setup lang="ts">
const appConfig = useAppConfig()
const colorMode = useColorMode()
const route = useRoute()

// Sidebar state
const sidebarOpen = ref(true)
const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

// Toggle functions
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleMobileSidebar = () => {
  mobileSidebarOpen.value = !mobileSidebarOpen.value
}

// Close mobile sidebar on route change
watch(() => route.path, () => {
  mobileSidebarOpen.value = false
})

// Color mode toggle
const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Provide sidebar state to children
provide('sidebarCollapsed', sidebarCollapsed)
provide('toggleSidebar', toggleSidebar)

// Fetch global settings
import { useKosStore } from '~/stores/kos'
const store = useKosStore()
onMounted(() => {
  store.fetchSettings()
})
</script>

<template>
  <div class="app-layout bg-gray-50 dark:bg-gray-950">
    <!-- Mobile Sidebar Overlay -->
    <Transition name="fade">
      <div
        v-if="mobileSidebarOpen"
        class="fixed inset-0 bg-black/50 z-30 lg:hidden"
        @click="mobileSidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="app-sidebar border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-visible"
      :class="{
        'collapsed': sidebarCollapsed,
        'open': mobileSidebarOpen
      }"
    >
      <LayoutTheSidebar
        :collapsed="sidebarCollapsed"
        @toggle="toggleSidebar"
      />
    </aside>

    <!-- Main Content -->
    <div
      class="app-main flex flex-col"
      :class="{ 'lg:ml-16': sidebarCollapsed }"
    >
      <!-- Header -->
      <header class="app-header border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <LayoutTheHeader
          :color-mode="colorMode.value"
          @toggle-sidebar="toggleMobileSidebar"
          @toggle-desktop-sidebar="toggleSidebar"
          @toggle-color-mode="toggleColorMode"
        />
      </header>

      <!-- Page Content -->
      <main class="app-content flex-1">
        <slot />
      </main>

      <!-- Footer -->
      <footer class="border-t border-gray-200 dark:border-gray-800 px-6 py-4">
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 {{ appConfig?.app?.name || 'NuxtBase' }}. All rights reserved.</p>
          <p>v{{ appConfig?.app?.version || '1.0.0' }}</p>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
