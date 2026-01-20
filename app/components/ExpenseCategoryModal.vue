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
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  isActive: z.boolean()
})

type Schema = z.output<typeof schema>

// Predefined colors
const colorOptions = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' }
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
        title: 'Category Updated',
        description: 'Category has been updated successfully.',
        color: 'success',
      })
    } else {
      await $fetch('/api/expenses/categories', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Category Created',
        description: 'New category has been added successfully.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Failed to save category',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="category ? 'Edit Category' : 'Add New Category'">
    <template #default />
    
    <template #content>
      <div class="p-6">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          
          <div class="space-y-4">
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category Name</label>
              <UInput v-model="state.name" placeholder="e.g. Pool Maintenance" autofocus class="w-full" />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <UTextarea v-model="state.description" placeholder="Optional description..." class="w-full" />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
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
                <span class="text-sm text-gray-500">Custom:</span>
                <input v-model="state.color" type="color" class="h-8 w-16 rounded cursor-pointer" />
                <span class="text-xs text-gray-400 font-mono">{{ state.color }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Active Status</label>
                <p class="text-xs text-gray-500 mt-1">Inactive categories won't appear in expense forms</p>
              </div>
              <USwitch v-model="state.isActive" />
            </div>

            <!-- Preview -->
            <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p class="text-xs text-gray-500 mb-2">Preview:</p>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: state.color }" />
                <span class="font-medium">{{ state.name || 'Category Name' }}</span>
                <span v-if="state.description" class="text-sm text-gray-500">- {{ state.description }}</span>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton label="Cancel" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Save Category" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
