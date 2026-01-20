<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

interface ExpenseCategory {
  id: string
  name: string
  description?: string
  color: string
  isActive: boolean
}

const props = defineProps<{
  modelValue: boolean
  category?: ExpenseCategory
}>()

const emit = defineEmits(['update:modelValue', 'saved'])

const toast = useToast()
const isSaving = ref(false)

const state = reactive({
  name: '',
  description: '',
  color: '#6366f1',
  isActive: true
})

// Validation Schema
const schema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna tidak valid'),
  isActive: z.boolean()
})

type Schema = z.output<typeof schema>

// Predefined colors
const colorOptions = [
  { value: '#ef4444', label: 'Merah' },
  { value: '#f59e0b', label: 'Oranye' },
  { value: '#eab308', label: 'Kuning' },
  { value: '#10b981', label: 'Hijau' },
  { value: '#3b82f6', label: 'Biru' },
  { value: '#6366f1', label: 'Nila' },
  { value: '#8b5cf6', label: 'Ungu' },
  { value: '#ec4899', label: 'Merah Muda' },
  { value: '#6b7280', label: 'Abu-abu' }
]

// Sync with prop for Edit Mode
watch(() => props.category, (newVal) => {
  if (newVal) {
    state.name = newVal.name
    state.description = newVal.description || ''
    state.color = newVal.color
    state.isActive = newVal.isActive
  } else {
    // Reset for Add Mode
    state.name = ''
    state.description = ''
    state.color = '#6366f1'
    state.isActive = true
  }
}, { immediate: true })

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  const data = event.data
  
  isSaving.value = true
  
  try {
    const payload = {
      ...data,
      description: data.description || null
    }
    
    if (props.category) {
      await $fetch(`/api/expenses/categories/${props.category.id}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({
        title: 'Kategori Diperbarui',
        description: 'Kategori berhasil diperbarui.',
        color: 'success',
      })
    } else {
      await $fetch('/api/expenses/categories', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Kategori Dibuat',
        description: 'Kategori baru berhasil ditambahkan.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Gagal',
      description: err?.data?.message || err?.message || 'Gagal menyimpan kategori',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="category ? 'Edit Kategori' : 'Tambah Kategori Baru'">
    <template #default />
    
    <template #content>
      <div class="p-6">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          
          <div class="space-y-4">
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Kategori</label>
              <UInput v-model="state.name" placeholder="contoh: Perawatan Kolam Renang" autofocus class="w-full" />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
              <UTextarea v-model="state.description" placeholder="Deskripsi opsional..." class="w-full" />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Warna</label>
              <div class="grid grid-cols-9 gap-2">
                <button
                  v-for="colorOption in colorOptions"
                  :key="colorOption.value"
                  type="button"
                  class="w-10 h-10 rounded-lg border-2 transition-all hover:scale-110"
                  :class="state.color === colorOption.value ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : 'border-gray-200 dark:border-gray-700'"
                  :style="{ backgroundColor: colorOption.value }"
                  :title="colorOption.label"
                  @click="state.color = colorOption.value"
                />
              </div>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-sm text-gray-500">Kustom:</span>
                <input v-model="state.color" type="color" class="h-8 w-16 rounded cursor-pointer" />
                <span class="text-xs text-gray-400 font-mono">{{ state.color }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status Aktif</label>
                <p class="text-xs text-gray-500 mt-1">Kategori tidak aktif tidak akan muncul di formulir pengeluaran</p>
              </div>
              <USwitch v-model="state.isActive" />
            </div>

            <!-- Preview -->
            <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p class="text-xs text-gray-500 mb-2">Pratinjau:</p>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: state.color }" />
                <span class="font-medium">{{ state.name || 'Nama Kategori' }}</span>
                <span v-if="state.description" class="text-sm text-gray-500">- {{ state.description }}</span>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton label="Batal" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Simpan Kategori" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
