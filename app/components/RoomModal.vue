<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import { useKosStore, type Room } from '~/stores/kos'

const props = defineProps<{
  modelValue: boolean
  propertyId: string
  room?: Room
}>()

const emit = defineEmits(['update:modelValue', 'saved'])

const store = useKosStore()
const toast = useToast()

const isSaving = ref(false)

const state = reactive({
  name: '',
  price: 0,
  status: 'available' as 'available' | 'occupied' | 'maintenance',
})

// Status options - NO occupied option in modal (occupied can only be set in manage room page)
const statusOptions = computed(() => {
  // If room is currently occupied, don't allow changing status in modal
  if (props.room?.status === 'occupied') {
    return [{ label: 'Occupied', value: 'occupied' }]
  }
  // For new rooms or non-occupied rooms, only allow available/maintenance
  return [
    { label: 'Available', value: 'available' },
    { label: 'Maintenance', value: 'maintenance' }
  ]
})

// Check if room is currently occupied
const isOccupied = computed(() => props.room?.status === 'occupied')

const schema = z.object({
  name: z.string().min(1, 'Room name is required'),
  price: z.number().min(0, 'Price must be positive'),
  status: z.enum(['available', 'occupied', 'maintenance']),
})

type Schema = z.output<typeof schema>

watch(() => props.room, (newVal) => {
  if (newVal) {
    state.name = newVal.name || ''
    state.price = Number(newVal.price)
    state.status = newVal.status
  } else {
    state.name = ''
    state.price = 1000000
    state.status = 'available'
  }
}, { immediate: true })

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  const data = event.data as any
  
  isSaving.value = true

  try {
    // If room is occupied, don't allow changing status via modal
    const payload: any = {
      name: data.name,
      price: Number(data.price),
      propertyId: props.propertyId,
    }
    
    // Only update status if room is not occupied
    if (!isOccupied.value) {
      payload.status = data.status
    }

    if (props.room) {
      await store.updateRoom(props.room.id, payload)
      toast.add({
        title: 'Room Updated',
        description: 'Room has been updated successfully.',
        color: 'success',
      })
    } else {
      payload.status = data.status
      await store.addRoom(payload)
      toast.add({
        title: 'Room Created',
        description: 'New room has been added successfully.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Failed to save room',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="room ? 'Edit Room' : 'Add New Room'">
    <template #default />
    
    <template #content>
      <div class="p-6">
        <!-- Occupied Room Banner -->
        <div v-if="isOccupied && room" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div class="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
            <span class="text-sm font-medium">
              Room occupied by <strong>{{ room.tenantName || 'Unknown tenant' }}</strong>
            </span>
          </div>
          <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
            To change tenant or make room available, use the "Manage" page.
          </p>
        </div>

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Room Name/Number</label>
            <UInput v-model="state.name" placeholder="e.g. 101" autofocus class="w-full" />
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Room Price (Monthly)</label>
            <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 text-sm">Rp</span>
                <UInput v-model="state.price" type="number" placeholder="0" class="pl-8 w-full" />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <USelect 
              v-model="state.status" 
              :items="statusOptions" 
              value-key="value" 
              label-key="label"
              class="w-full"
              :disabled="isOccupied"
            />
            <p v-if="isOccupied" class="text-xs text-gray-500 mt-1">
              Status cannot be changed while room is occupied.
            </p>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <UButton label="Cancel" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Save Room" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

