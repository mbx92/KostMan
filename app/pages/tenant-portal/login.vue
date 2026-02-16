<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['tenant-guest']
})

const contact = ref('')
const pin = ref('')
const loading = ref(false)
const error = ref('')

const toast = useToast()
const router = useRouter()
const route = useRoute()

// Show success message if redirected after PIN change
onMounted(() => {
  if (route.query.changed === 'true') {
    toast.add({
      title: 'PIN Berhasil Diubah',
      description: 'Silakan login dengan PIN baru Anda',
      color: 'success',
    })
  }
})

const login = async () => {
  error.value = ''
  
  if (!contact.value || !pin.value) {
    error.value = 'Nomor HP dan PIN wajib diisi'
    return
  }

  if (pin.value.length !== 4) {
    error.value = 'PIN harus 4 digit'
    return
  }

  loading.value = true
  
  try {
    const response = await $fetch<{
      success: boolean
      token: string
      tenant: any
      isDefaultPin: boolean
    }>('/api/tenant-auth/login', {
      method: 'POST',
      body: {
        contact: contact.value,
        pin: pin.value,
      },
    })

    if (response.success) {
      // Store token in cookie
      const token = useCookie('tenant-token', {
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })
      token.value = response.token

      toast.add({
        title: 'Login Berhasil',
        description: `Selamat datang, ${response.tenant.name}!`,
        color: 'success',
      })

      // Redirect with full page reload for iOS compatibility
      // Small delay to ensure cookie is set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      if (response.isDefaultPin) {
        window.location.href = '/tenant-portal/change-pin';
      } else {
        window.location.href = '/tenant-portal';
      }
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Login gagal'
    toast.add({
      title: 'Login Gagal',
      description: error.value,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Format phone number as user types
watch(contact, (val) => {
  // Remove non-digit characters
  const cleaned = val.replace(/\D/g, '')
  contact.value = cleaned
})

// Only allow digits for PIN
watch(pin, (val) => {
  const cleaned = val.replace(/\D/g, '').slice(0, 4)
  pin.value = cleaned
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <UIcon name="i-heroicons-home-modern" class="w-16 h-16 text-primary-500 mx-auto mb-4" />
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Portal Penghuni</h1>
        <p class="text-gray-600 dark:text-gray-400">Lihat dan bayar tagihan kost Anda</p>
      </div>

      <!-- Login Card -->
      <UCard>
        <form @submit.prevent="login" class="space-y-6">
          <div>
            <UFormField label="Nomor HP" required>
              <UInput
                v-model="contact"
                type="tel"
                placeholder="081234567890"
                icon="i-heroicons-phone"
                size="lg"
                :disabled="loading"
                class="w-full"
              />
            </UFormField>
            <p class="text-xs text-gray-500 mt-1">Nomor HP yang terdaftar sebagai penghuni</p>
          </div>

          <div>
            <UFormField label="PIN" required>
              <UInput
                v-model="pin"
                type="password"
                placeholder="••••"
                icon="i-heroicons-lock-closed"
                size="lg"
                maxlength="4"
                :disabled="loading"
                class="w-full"
              />
            </UFormField>
            <p class="text-xs text-gray-500 mt-1">
              PIN default: 4 digit terakhir nomor HP Anda
            </p>
          </div>

          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p class="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
              {{ error }}
            </p>
          </div>

          <UButton
            type="submit"
            color="primary"
            size="lg"
            block
            :loading="loading"
            :disabled="!contact || pin.length !== 4"
          >
            <template v-if="!loading">
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5 mr-2" />
              Masuk
            </template>
            <template v-else>
              Memproses...
            </template>
          </UButton>
        </form>
      </UCard>

      <!-- Info Card -->
      <UCard class="mt-6">
        <div class="space-y-3">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white text-sm">Cara Login</h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Masukkan nomor HP dan PIN Anda. Jika ini pertama kali login, gunakan 4 digit terakhir nomor HP sebagai PIN.
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white text-sm">Keamanan</h3>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Anda akan diminta mengganti PIN default saat pertama kali login untuk keamanan akun Anda.
              </p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Back to Home -->
      <div class="text-center mt-6">
        <NuxtLink to="/" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500">
          ← Kembali ke Beranda
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
