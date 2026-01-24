<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

// Retrieve current user from auth state
const { data: session } = await useFetch('/api/auth/me', {
  headers: useRequestHeaders(['cookie']) as any
})
const user = computed(() => session.value?.user)

const toast = useToast()
const loading = ref(false)

const state = reactive({
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: ''
})

const schema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
  confirmNewPassword: z.string().min(1, 'Konfirmasi password wajib diisi')
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Password baru tidak sama",
  path: ["confirmNewPassword"]
})

type Schema = z.output<typeof schema>

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: event.data
    })
    
    toast.add({ title: 'Berhasil', description: 'Password berhasil diubah', color: 'success' })
    
    // Reset form
    state.currentPassword = ''
    state.newPassword = ''
    state.confirmNewPassword = ''
  } catch (error: any) {
    toast.add({ 
      title: 'Gagal', 
      description: error.data?.message || error.message || 'Gagal mengubah password', 
      color: 'error' 
    })
  } finally {
    loading.value = false
  }
}

const getRoleColor = (role: string) => {
    switch (role) {
        case 'owner': return 'primary'
        case 'admin': return 'info'
        case 'staff': return 'neutral'
        default: return 'neutral'
    }
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-user-circle" class="w-8 h-8 text-primary-500" />
           Profil Saya
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola informasi akun Anda.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- User Info Card -->
      <UCard class="md:col-span-1 h-fit">
        <template #header>
          <div class="font-semibold">Informasi Akun</div>
        </template>
        
        <div class="space-y-4" v-if="user">
          <div class="flex flex-col items-center py-4">
            <div class="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
               <span class="text-2xl font-bold text-primary-500">{{ user.name.charAt(0).toUpperCase() }}</span>
            </div>
            <h3 class="font-bold text-lg">{{ user.name }}</h3>
            <p class="text-sm text-gray-500">{{ user.email }}</p>
            <UBadge :color="getRoleColor(user.role)" variant="subtle" class="mt-2 capitalize">
                {{ user.role }}
            </UBadge>
          </div>
          
          <UDivider />
          
          <div class="space-y-2 text-sm">
             <div class="flex justify-between">
               <span class="text-gray-500">Member Sejak</span>
               <span>{{ new Date().getFullYear() }}</span>
             </div>
          </div>
        </div>
      </UCard>

      <!-- Change Password Card -->
      <UCard class="md:col-span-2">
        <template #header>
          <div class="font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-key" />
            Ganti Password
          </div>
        </template>

        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password Saat Ini <span class="text-red-500">*</span></label>
            <UInput v-model="state.currentPassword" type="password" placeholder="Masukkan password saat ini" icon="i-heroicons-lock-closed" class="w-full" />
          </div>

          <UDivider label="Password Baru" class="py-2" />

          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password Baru <span class="text-red-500">*</span></label>
              <UInput v-model="state.newPassword" type="password" placeholder="Minimal 8 karakter" icon="i-heroicons-key" class="w-full" />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Konfirmasi Password Baru <span class="text-red-500">*</span></label>
              <UInput v-model="state.confirmNewPassword" type="password" placeholder="Ulangi password baru" icon="i-heroicons-key" class="w-full" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <UButton type="submit" :loading="loading" color="primary" class="px-6">
              Simpan Password Baru
            </UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </div>
</template>
