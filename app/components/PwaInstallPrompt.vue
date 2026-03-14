<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

// PWA update handling
const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegistered(r) {
    r && setInterval(() => r.update(), 60 * 60 * 1000) // Check for updates every hour
  },
})

// Install prompt (beforeinstallprompt — Android/Desktop Chrome)
const deferredPrompt = ref<any>(null)
const showInstallBanner = ref(false)
const showIosBanner = ref(false)
const dismissed = ref(false)

const isIos = computed(() => {
  if (!process.client) return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
})

const isInStandaloneMode = computed(() => {
  if (!process.client) return false
  return ('standalone' in navigator && (navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
})

onMounted(() => {
  // Don't show if already installed / already dismissed this session
  if (isInStandaloneMode.value) return
  const wasDismissed = localStorage.getItem('pwa-prompt-dismissed')
  if (wasDismissed) return

  // iOS: show manual guide (no beforeinstallprompt on iOS)
  if (isIos.value) {
    setTimeout(() => { showIosBanner.value = true }, 3000)
    return
  }

  // Android / Chrome Desktop: listen for native prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
    setTimeout(() => { showInstallBanner.value = true }, 3000)
  })
})

async function installApp() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  deferredPrompt.value = null
  showInstallBanner.value = false
  if (outcome === 'accepted') {
    localStorage.setItem('pwa-prompt-dismissed', '1')
  }
}

function dismiss() {
  showInstallBanner.value = false
  showIosBanner.value = false
  dismissed.value = true
  localStorage.setItem('pwa-prompt-dismissed', '1')
}

function reload() {
  updateServiceWorker(true)
}
</script>

<template>
  <!-- Update available toast -->
  <Transition name="slide-up">
    <div
      v-if="needRefresh"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
    >
      <UCard class="shadow-xl border border-primary-200 dark:border-primary-800">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-primary-500 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">Update tersedia</p>
            <p class="text-xs text-gray-500">Versi baru KostMan siap digunakan.</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <UButton size="xs" variant="ghost" color="neutral" @click="dismiss">Nanti</UButton>
            <UButton size="xs" color="primary" @click="reload">Update</UButton>
          </div>
        </div>
      </UCard>
    </div>
  </Transition>

  <!-- Android/Desktop: native install banner -->
  <Transition name="slide-up">
    <div
      v-if="showInstallBanner && !needRefresh"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
    >
      <UCard class="shadow-xl border border-blue-200 dark:border-blue-800">
        <div class="flex items-center gap-3">
          <img src="/icons/icon-192x192.png" alt="KostMan" class="w-10 h-10 rounded-xl shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold">Install KostMan</p>
            <p class="text-xs text-gray-500">Akses lebih cepat dari home screen.</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <UButton size="xs" variant="ghost" color="neutral" @click="dismiss">Nanti</UButton>
            <UButton size="xs" color="primary" @click="installApp">Install</UButton>
          </div>
        </div>
      </UCard>
    </div>
  </Transition>

  <!-- iOS: manual add to home screen guide -->
  <Transition name="slide-up">
    <div
      v-if="showIosBanner && !needRefresh"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
    >
      <UCard class="shadow-xl border border-blue-200 dark:border-blue-800">
        <div class="flex items-start gap-3">
          <img src="/icons/apple-touch-icon.png" alt="KostMan" class="w-10 h-10 rounded-xl shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold">Install di iPhone/iPad</p>
            <p class="text-xs text-gray-500 mt-1">
              Tap ikon
              <UIcon name="i-heroicons-arrow-up-on-square" class="inline w-3.5 h-3.5 align-text-bottom" />
              <strong> Share</strong>, lalu pilih
              <strong>"Add to Home Screen"</strong>.
            </p>
          </div>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="dismiss" />
        </div>
      </UCard>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 1rem);
}
</style>
