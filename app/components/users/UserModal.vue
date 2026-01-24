<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

const props = defineProps<{
  modelValue: boolean
  user?: any
}>()

const emit = defineEmits(['update:modelValue', 'success'])

const isEdit = computed(() => !!props.user)
const loading = ref(false)
const toast = useToast()

const state = reactive({
  name: '',
  email: '',
  role: 'staff' as 'owner' | 'admin' | 'staff',
  password: '',
  confirmPassword: ''
})

// Validation Schema
const baseSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  role: z.enum(['owner', 'admin', 'staff']),
})

const createSchema = baseSchema.extend({
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password tidak sama",
  path: ["confirmPassword"]
})

const updateSchema = baseSchema

const schema = computed(() => isEdit.value ? updateSchema : createSchema)

// Reset state
watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.user) {
      state.name = props.user.name
      state.email = props.user.email
      state.role = props.user.role || 'staff'
      state.password = ''
      state.confirmPassword = ''
    } else {
      state.name = ''
      state.email = ''
      state.role = 'staff'
      state.password = ''
      state.confirmPassword = ''
    }
  }
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const roleOptions = [
  { label: 'Owner', value: 'owner' },
  { label: 'Admin', value: 'admin' },
  { label: 'Staff', value: 'staff' },
]

const onSubmit = async (event: FormSubmitEvent<any>) => {
    loading.value = true
    try {
        if (isEdit.value) {
            await $fetch(`/api/users/${props.user?.id}`, {
                method: 'PUT',
                body: {
                    name: state.name,
                    email: state.email,
                    role: state.role
                }
            })
            toast.add({ title: 'User berhasil diupdate', color: 'success' })
        } else {
            await $fetch('/api/users', {
                method: 'POST',
                body: {
                    name: state.name,
                    email: state.email,
                    role: state.role,
                    password: state.password
                }
            })
            toast.add({ title: 'User berhasil dibuat', color: 'success' })
        }
        emit('success')
        isOpen.value = false
    } catch (error: any) {
        toast.add({ title: 'Error', description: error.data?.message || 'Terjadi kesalahan', color: 'error' })
    } finally {
        loading.value = false
    }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="isEdit ? 'Edit User' : 'Tambah User'">
    <template #content>
      <div class="p-6">
        <UForm :schema="schema" :state="state" @submit="onSubmit">
          <div class="space-y-4">
            <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama <span class="text-red-500">*</span></label>
                <UInput v-model="state.name" placeholder="John Doe" autofocus class="w-full" />
            </div>
            
            <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email <span class="text-red-500">*</span></label>
                <UInput v-model="state.email" type="email" placeholder="john@example.com" class="w-full" />
            </div>
            
            <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Role <span class="text-red-500">*</span></label>
                <USelect 
                    v-model="state.role" 
                    :items="roleOptions"
                    value-key="value" 
                    label-key="label"
                    class="w-full"
                />
            </div>

            <template v-if="!isEdit">
                <div class="space-y-1">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password <span class="text-red-500">*</span></label>
                    <UInput v-model="state.password" type="password" placeholder="********" class="w-full" />
                </div>

                <div class="space-y-1">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Konfirmasi Password <span class="text-red-500">*</span></label>
                    <UInput v-model="state.confirmPassword" type="password" placeholder="********" class="w-full" />
                </div>
            </template>
          </div>

          <div class="flex justify-end gap-2 mt-6">
              <UButton label="Batal" color="neutral" variant="ghost" @click="isOpen = false" />
              <UButton type="submit" :label="isEdit ? 'Simpan' : 'Buat User'" :loading="loading" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
