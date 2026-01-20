<script setup lang="ts">
interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})

const emit = defineEmits<{
  toggle: []
}>()

import { useKosStore } from '~/stores/kos'
const store = useKosStore()
const { settings } = storeToRefs(store)
const appConfig = useAppConfig()
const route = useRoute()

// Fetch current user
const { data: authData } = await useFetch('/api/auth/me')
const currentUser = computed(() => authData.value?.user)

interface NavItem {
  label: string
  icon?: string
  to?: string
  children?: NavItem[]
}

// Default navigation if app.config doesn't provide it
const defaultNavigation: NavItem[] = [
  {
    label: 'Dashboard',
    icon: 'i-heroicons-home',
    to: '/'
  },
  {
    label: 'Properties',
    icon: 'i-heroicons-building-office',
    to: '/properties'
  },
  {
    label: 'Rooms',
    icon: 'i-heroicons-home-modern',
    to: '/rooms'
  },
  {
    label: 'Tenants',
    icon: 'i-heroicons-users',
    to: '/tenants'
  },
  {
    label: 'Reminders',
    icon: 'i-heroicons-bell-alert',
    to: '/reminders'
  },
  {
    label: 'Billing',
    icon: 'i-heroicons-banknotes',
    to: '/billing'
  },
  {
    label: 'Settings',
    icon: 'i-heroicons-cog-6-tooth',
    to: '/settings'
  },
  {
    label: 'Pricing',
    icon: 'i-heroicons-tag',
    to: '/pricing'
  },
]

// Navigation items from app config with fallback
const navigation = computed(() => appConfig.navigation?.sidebar || defaultNavigation)

// Track expanded items
const expandedItems = ref<Set<string>>(new Set())

const toggleExpand = (label: string) => {
  if (expandedItems.value.has(label)) {
    expandedItems.value.delete(label)
  } else {
    expandedItems.value.add(label)
  }
}

const isExpanded = (label: string) => expandedItems.value.has(label)

const isActive = (to: string | undefined) => {
  if (!to) return false
  return route.path === to || route.path.startsWith(to + '/')
}

// Auto-expand parent when child is active
onMounted(() => {
  navigation.value.forEach((item: any) => {
    if (item.children) {
      const hasActiveChild = item.children.some((child: any) => {
        if (child.to && isActive(child.to)) return true
        if (child.children) {
          return child.children.some((grandchild: any) => isActive(grandchild.to))
        }
        return false
      })
      if (hasActiveChild) {
        expandedItems.value.add(item.label)
        // Also expand nested items
        item.children.forEach((child: any) => {
          if (child.children?.some((gc: any) => isActive(gc.to))) {
            expandedItems.value.add(child.label)
          }
        })
      }
    }
  })
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Logo -->
    <div class="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800" :class="collapsed ? 'justify-center' : ''">
      <NuxtLink to="/" class="flex items-center gap-3 overflow-hidden">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
          <UIcon name="i-heroicons-cube" class="w-5 h-5 text-white" />
        </div>
        <Transition name="slide-fade">
          <span v-if="!collapsed" class="font-bold text-lg text-gray-900 dark:text-white whitespace-nowrap">
            {{ settings?.appName || appConfig.app?.name || 'NuxtBase' }}
          </span>
        </Transition>
      </NuxtLink>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-3">
      <ul class="space-y-1">
        <li v-for="item in navigation" :key="item.label">
          <!-- Simple link -->
          <NuxtLink
            v-if="item.to && !item.children"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            :class="[
              isActive(item.to)
                ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            ]"
          >
            <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
            <Transition name="slide-fade">
              <span v-if="!collapsed">{{ item.label }}</span>
            </Transition>
          </NuxtLink>

          <!-- Expandable group -->
          <div v-else-if="item.children">
            <button
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="toggleExpand(item.label)"
            >
              <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
              <Transition name="slide-fade">
                <span v-if="!collapsed" class="flex-1 text-left">{{ item.label }}</span>
              </Transition>
              <UIcon
                v-if="!collapsed"
                name="i-heroicons-chevron-down"
                class="w-4 h-4 transition-transform"
                :class="{ 'rotate-180': isExpanded(item.label) }"
              />
            </button>

            <!-- Children -->
            <Transition name="expand">
              <ul v-if="isExpanded(item.label) && !collapsed" class="mt-1 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">
                <li v-for="child in item.children" :key="child.label">
                  <!-- Nested group -->
                  <template v-if="child.children">
                    <button
                      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      @click="toggleExpand(child.label)"
                    >
                      <UIcon v-if="child.icon" :name="child.icon" class="w-4 h-4" />
                      <span class="flex-1 text-left">{{ child.label }}</span>
                      <UIcon
                        name="i-heroicons-chevron-down"
                        class="w-3 h-3 transition-transform"
                        :class="{ 'rotate-180': isExpanded(child.label) }"
                      />
                    </button>

                    <Transition name="expand">
                      <ul v-if="isExpanded(child.label)" class="mt-1 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1">
                        <li v-for="grandchild in child.children" :key="grandchild.label">
                          <NuxtLink
                            :to="grandchild.to"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                            :class="[
                              isActive(grandchild.to)
                                ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            ]"
                          >
                            {{ grandchild.label }}
                          </NuxtLink>
                        </li>
                      </ul>
                    </Transition>
                  </template>

                  <!-- Simple child link -->
                  <NuxtLink
                    v-else
                    :to="child.to"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                    :class="[
                      isActive(child.to)
                        ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    ]"
                  >
                    <UIcon v-if="child.icon" :name="child.icon" class="w-4 h-4" />
                    <span>{{ child.label }}</span>
                  </NuxtLink>
                </li>
              </ul>
            </Transition>
          </div>
        </li>
      </ul>
    </nav>

  </div>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}
</style>
