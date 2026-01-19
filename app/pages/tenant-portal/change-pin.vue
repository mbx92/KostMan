<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['tenant-auth']
})

const oldPin = ref('')
const newPin = ref('')
const confirmPin = ref('')
const loading = ref(false)
const error = ref('')

const toast = useToast()
const router = useRouter()
const token = useCookie('tenant-token')

const changePin = async () => {
  error.value = ''

  // Validation
  if (!oldPin.value || !newPin.value || !confirmPin.value) {
    error.value = 'Semua field wajib diisi'
    return
  }

  if (oldPin.value.length !== 4 || newPin.value.length !== 4 || confirmPin.value.length !== 4) {
    error.value = 'PIN harus 4 digit'
    return
  }

  if (newPin.value !== confirmPin.value) {
    error.value = 'PIN baru dan konfirmasi tidak sama'
    return
  }

  if (oldPin.value === newPin.value) {
    error.value = 'PIN baru harus berbeda dari PIN lama'
    return
  }

  loading.value = true

  try {
    const response = await $fetch('/api/tenant-auth/change-pin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
      body: {
        oldPin: oldPin.value,
        newPin: newPin.value,
      },
    })

    toast.add({
      title: 'PIN Berhasil Diubah',
      description: 'PIN Anda telah berhasil diubah.',
      color: 'success',
    })

    // Clear old token and redirect to dashboard
    // The middleware will allow access since PIN is no longer default
    token.value = null
    
    // Small delay to show toast
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Redirect to login with success state
    await navigateTo('/tenant-portal/login?changed=true')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Gagal mengubah PIN'
    toast.add({
      title: 'Gagal Mengubah PIN',
      description: error.value,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Only allow digits for PIN
watch([oldPin, newPin, confirmPin], ([old, newP, conf]) => {
  oldPin.value = old.replace(/\D/g, '').slice(0, 4)
  newPin.value = newP.replace(/\D/g, '').slice(0, 4)
  confirmPin.value = conf.replace(/\D/g, '').slice(0, 4)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-amber-50 to-amber-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-shield-exclamation" class="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Ubah PIN</h1>
        <p class="text-gray-600 dark:text-gray-400">Untuk keamanan, silakan ubah PIN default Anda</p>
      </div>

      <!-- Alert -->
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-amber-800 dark:text-amber-200 text-sm">PIN Default Terdeteksi</h3>
            <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Anda menggunakan PIN default (4 digit terakhir nomor HP). Harap ubah PIN Anda untuk keamanan akun.
            </p>
          </div>
        </div>
      </div>

      <!-- Form Card -->
      <UCard>
        <form @submit.prevent="changePin" class="space-y-5">
          <div>
            <UFormField label="PIN Lama" required>
              <UInput
                v-model="oldPin"
                type="password"
                placeholder="••••"
                icon="i-heroicons-lock-closed"
                size="lg"
                maxlength="4"
                :disabled="loading"
                class="w-full"
              />
            </UFormField>
            <p class="text-xs text-gray-500 mt-1">PIN default: 4 digit terakhir nomor HP</p>
          </div>

          <div>
            <UFormField label="PIN Baru" required>
              <UInput
                v-model="newPin"
                type="password"
                placeholder="••••"
                icon="i-heroicons-key"
                size="lg"
                maxlength="4"
                :disabled="loading"
                class="w-full"
              />
            </UFormField>
            <p class="text-xs text-gray-500 mt-1">Pilih 4 digit angka yang mudah diingat</p>
          </div>

          <div>
            <UFormField label="Konfirmasi PIN Baru" required>
              <UInput
                v-model="confirmPin"
                type="password"
                placeholder="••••"
                icon="i-heroicons-check-circle"
                size="lg"
                maxlength="4"
                :disabled="loading"
                class="w-full"
              />
            </UFormField>
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
            :disabled="!oldPin || !newPin || !confirmPin || newPin.length !== 4 || confirmPin.length !== 4"
          >
            <template v-if="!loading">
              <UIcon name="i-heroicons-check" class="w-5 h-5 mr-2" />
              Ubah PIN
            </template>
            <template v-else>
              Memproses...
            </template>
          </UButton>
        </form>
      </UCard>

      <!-- Security Tips -->
      <UCard class="mt-6">
        <div class="space-y-2">
          <h3 class="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <UIcon name="i-heroicons-light-bulb" class="w-4 h-4 text-yellow-500" />
            Tips Keamanan PIN
          </h3>
          <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-6">
            <li>• Jangan gunakan tanggal lahir atau urutan angka sederhana (1234)</li>
            <li>• Jangan bagikan PIN Anda kepada siapapun</li>
            <li>• Gunakan kombinasi angka yang mudah Anda ingat tapi sulit ditebak</li>
          </ul>
        </div>
      </UCard>
    </div>
  </div>
</template>
