<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import { useKosStore, type Property } from '~/stores/kos'

const props = defineProps<{
  modelValue: boolean
  property?: Property
}>()

const emit = defineEmits(['update:modelValue', 'saved'])

const store = useKosStore()
const toast = useToast()
const { settings: globalSettings } = storeToRefs(store)

const isSaving = ref(false)

const state = reactive({
  name: '',
  address: '',
  description: '',
  image: '',
  // Settings overrides
  overrideSettings: false,
  costPerKwh: globalSettings.value.costPerKwh,
  waterFee: globalSettings.value.waterFee,
  trashFee: globalSettings.value.trashFee
})

// Validation Schema
const schema = z.object({
  name: z.string().min(3, 'Name is too short'),
  address: z.string().min(5, 'Address is too short'),
  description: z.string().optional(),
  image: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  // Settings validation
  overrideSettings: z.boolean(),
  costPerKwh: z.number().min(0).optional(),
  waterFee: z.number().min(0).optional(),
  trashFee: z.number().min(0).optional()
})

type Schema = z.output<typeof schema>

// Sync with prop for Edit Mode
watch(() => props.property, (newVal) => {
  if (newVal) {
    state.name = newVal.name
    state.address = newVal.address
    state.description = newVal.description
    state.image = newVal.image
    
    // Load existing settings
    if (newVal.settings) {
        state.overrideSettings = true
        state.costPerKwh = Number(newVal.settings.costPerKwh)
        state.waterFee = Number(newVal.settings.waterFee)
        state.trashFee = Number(newVal.settings.trashFee)
    } else {
        state.overrideSettings = false
        state.costPerKwh = globalSettings.value.costPerKwh
        state.waterFee = globalSettings.value.waterFee
        state.trashFee = globalSettings.value.trashFee
    }
  } else {
    // Reset for Add Mode with defaults
    state.name = ''
    state.address = ''
    state.description = ''
    state.image = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80'
    state.overrideSettings = false
    state.costPerKwh = globalSettings.value.costPerKwh
    state.waterFee = globalSettings.value.waterFee
    state.trashFee = globalSettings.value.trashFee
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
    const payload: any = {
      name: data.name,
      address: data.address,
      description: data.description || '',
      image: data.image || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    }
    
    if (state.overrideSettings) {
      payload.costPerKwh = data.costPerKwh
      payload.waterFee = data.waterFee
      payload.trashFee = data.trashFee
    }

    if (props.property) {
      await store.updateProperty(props.property.id, payload)
      toast.add({
        title: 'Property Updated',
        description: 'Property has been updated successfully.',
        color: 'success',
      })
    } else {
      await store.addProperty(payload)
      toast.add({
        title: 'Property Created',
        description: 'New property has been added successfully.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Failed to save property',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="property ? 'Edit Property' : 'Add New Property'">
    <!-- Empty default slot since we use external trigger -->
    <template #default />
    
    <template #content>
      <div class="p-6 max-h-[80vh] overflow-y-auto">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          
          <div class="space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-800">Basic Info</h3>
              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Property Name</label>
                <UInput v-model="state.name" placeholder="e.g. Kos Melati" autofocus class="w-full" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                <UTextarea v-model="state.address" placeholder="e.g. Jl. Sudirman No. 123" class="w-full" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
                <UInput v-model="state.image" placeholder="https://..." class="w-full" />
                <p class="text-xs text-gray-500 mt-1">Leave empty for default image</p>
              </div>
              
              <div v-if="state.image" class="w-full h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                  <img :src="state.image" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/600x400?text=No+Image'" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <UTextarea v-model="state.description" placeholder="Facility details, environment..." class="w-full" />
              </div>
          </div>

          <!-- Billing Settings -->
          <div class="space-y-4">
               <div class="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
                    <h3 class="font-medium text-gray-900 dark:text-white">Billing Configuration</h3>
                    <div class="flex items-center gap-2">
                         <span class="text-xs text-gray-500">Custom Rates</span>
                         <USwitch v-model="state.overrideSettings" />
                    </div>
               </div>

               <div v-if="!state.overrideSettings" class="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-sm text-gray-500">
                    Using global settings. Enable "Custom Rates" to override for this property.
                    <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                        <div class="bg-white dark:bg-gray-800 p-1 rounded border">Flash: {{ globalSettings.costPerKwh }}</div>
                        <div class="bg-white dark:bg-gray-800 p-1 rounded border">Water: {{ globalSettings.waterFee }}</div>
                        <div class="bg-white dark:bg-gray-800 p-1 rounded border">Trash: {{ globalSettings.trashFee }}</div>
                    </div>
               </div>

               <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                    <UFormField label="Electricity (/kWh)">
                        <UInput v-model="state.costPerKwh" type="number" step="100">
                             <template #leading>Rp</template>
                        </UInput>
                    </UFormField>
                    <UFormField label="Water Fee">
                        <UInput v-model="state.waterFee" type="number" step="1000">
                             <template #leading>Rp</template>
                        </UInput>
                    </UFormField>
                    <UFormField label="Trash Fee">
                        <UInput v-model="state.trashFee" type="number" step="1000">
                             <template #leading>Rp</template>
                        </UInput>
                    </UFormField>
               </div>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton label="Cancel" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Save Property" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
