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
  name: z.string().min(3, 'Nama terlalu pendek'),
  address: z.string().min(5, 'Alamat terlalu pendek'),
  description: z.string().optional(),
  image: z.string().url('Harus berupa URL yang valid').optional().or(z.literal('')),
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
        title: 'Properti Diperbarui',
        description: 'Properti berhasil diperbarui.',
        color: 'success',
      })
    } else {
      await store.addProperty(payload)
      toast.add({
        title: 'Properti Dibuat',
        description: 'Properti baru berhasil ditambahkan.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Gagal',
      description: err?.data?.message || err?.message || 'Gagal menyimpan properti',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="property ? 'Edit Properti' : 'Tambah Properti Baru'">
    <!-- Empty default slot since we use external trigger -->
    <template #default />
    
    <template #content>
      <div class="p-6 max-h-[80vh] overflow-y-auto">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          
          <div class="space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-800">Informasi Dasar</h3>
              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Properti</label>
                <UInput v-model="state.name" placeholder="contoh: Kos Melati" autofocus class="w-full" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Alamat</label>
                <UTextarea v-model="state.address" placeholder="contoh: Jl. Sudirman No. 123" class="w-full" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">URL Gambar</label>
                <UInput v-model="state.image" placeholder="https://..." class="w-full" />
                <p class="text-xs text-gray-500 mt-1">Kosongkan untuk gambar default</p>
              </div>
              
              <div v-if="state.image" class="w-full h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                  <img :src="state.image" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/600x400?text=No+Image'" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
                <UTextarea v-model="state.description" placeholder="Detail fasilitas, lingkungan..." class="w-full" />
              </div>
          </div>

          <!-- Billing Settings -->
          <div class="space-y-4">
               <div class="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
                    <h3 class="font-medium text-gray-900 dark:text-white">Konfigurasi Tagihan</h3>
                    <div class="flex items-center gap-2">
                         <span class="text-xs text-gray-500">Tarif Khusus</span>
                         <USwitch v-model="state.overrideSettings" />
                    </div>
               </div>

               <div v-if="!state.overrideSettings" class="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-sm text-gray-500">
                    Menggunakan pengaturan global. Aktifkan "Tarif Khusus" untuk mengubah tarif properti ini.
                    <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                        <div class="bg-white dark:bg-gray-800 p-1 rounded border">Listrik: {{ globalSettings.costPerKwh }}</div>
                        <div class="bg-white dark:bg-gray-800 p-1 rounded border">Air: {{ globalSettings.waterFee }}</div>
                        <div class="bg-white dark:bg-gray-800 p-1 rounded border">Sampah: {{ globalSettings.trashFee }}</div>
                    </div>
               </div>

               <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                    <UFormField label="Listrik (/kWh)">
                        <UInput v-model="state.costPerKwh" type="number" step="100">
                             <template #leading>Rp</template>
                        </UInput>
                    </UFormField>
                    <UFormField label="Biaya Air">
                        <UInput v-model="state.waterFee" type="number" step="1000">
                             <template #leading>Rp</template>
                        </UInput>
                    </UFormField>
                    <UFormField label="Biaya Sampah">
                        <UInput v-model="state.trashFee" type="number" step="1000">
                             <template #leading>Rp</template>
                        </UInput>
                    </UFormField>
               </div>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton label="Batal" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Simpan Properti" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
