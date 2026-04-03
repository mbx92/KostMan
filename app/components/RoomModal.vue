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
const { properties, settings: globalSettings } = storeToRefs(store)
const toast = useToast()

const isSaving = ref(false)

const state = reactive({
  propertyId: '',
  name: '',
  price: 0,
  status: 'available' as 'available' | 'occupied' | 'maintenance',
  overrideSettings: false,
  costPerKwh: 0,
  waterFee: 0,
  trashFee: 0,
})

// Status options - NO occupied option in modal (occupied can only be set in manage room page)
const statusOptions = computed(() => {
  // If room is currently occupied, don't allow changing status in modal
  if (props.room?.status === 'occupied') {
    return [{ label: 'Terisi', value: 'occupied' }]
  }
  // For new rooms or non-occupied rooms, only allow available/maintenance
  return [
    { label: 'Tersedia', value: 'available' },
    { label: 'Perbaikan', value: 'maintenance' }
  ]
})

// Check if room is currently occupied
const isOccupied = computed(() => props.room?.status === 'occupied')

// Property options
const propertyOptions = computed(() => 
  properties.value.map(p => ({ label: p.name, value: p.id }))
)

const selectedProperty = computed(() =>
  properties.value.find((property) => property.id === state.propertyId) || null
)

const inheritedSettings = computed(() => selectedProperty.value?.settings || globalSettings.value)

const schema = z.object({
  propertyId: z.string().min(1, 'Properti wajib dipilih'),
  name: z.string().min(1, 'Nama kamar wajib diisi'),
  price: z.number().min(0, 'Harga harus positif'),
  status: z.enum(['available', 'occupied', 'maintenance']),
  overrideSettings: z.boolean(),
  costPerKwh: z.number().min(0).optional(),
  waterFee: z.number().min(0).optional(),
  trashFee: z.number().min(0).optional(),
})

type Schema = z.output<typeof schema>

watch(() => props.room, (newVal) => {
  if (newVal) {
    state.propertyId = newVal.propertyId || props.propertyId
    state.name = newVal.name || ''
    state.price = Number(newVal.price)
    state.status = newVal.status
    state.overrideSettings = !!newVal.settings
    state.costPerKwh = Number(newVal.settings?.costPerKwh || newVal.property?.settings?.costPerKwh || globalSettings.value.costPerKwh || 0)
    state.waterFee = Number(newVal.settings?.waterFee || newVal.property?.settings?.waterFee || globalSettings.value.waterFee || 0)
    state.trashFee = Number(newVal.settings?.trashFee || newVal.property?.settings?.trashFee || globalSettings.value.trashFee || 0)
  } else {
    state.propertyId = props.propertyId
    state.name = ''
    state.price = 1000000
    state.status = 'available'
    state.overrideSettings = false
    state.costPerKwh = Number(inheritedSettings.value?.costPerKwh || 0)
    state.waterFee = Number(inheritedSettings.value?.waterFee || 0)
    state.trashFee = Number(inheritedSettings.value?.trashFee || 0)
  }
}, { immediate: true })

watch(inheritedSettings, (settings) => {
  if (!state.overrideSettings && settings) {
    state.costPerKwh = Number(settings.costPerKwh || 0)
    state.waterFee = Number(settings.waterFee || 0)
    state.trashFee = Number(settings.trashFee || 0)
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
      propertyId: data.propertyId,
      overrideSettings: data.overrideSettings,
    }

    if (data.overrideSettings) {
      payload.costPerKwh = Number(data.costPerKwh)
      payload.waterFee = Number(data.waterFee)
      payload.trashFee = Number(data.trashFee)
    }
    
    // Only update status if room is not occupied
    if (!isOccupied.value) {
      payload.status = data.status
    }

    if (props.room) {
      await store.updateRoom(props.room.id, payload)
      toast.add({
        title: 'Kamar Diperbarui',
        description: 'Kamar berhasil diperbarui.',
        color: 'success',
      })
    } else {
      payload.status = data.status
      await store.addRoom(payload)
      toast.add({
        title: 'Kamar Dibuat',
        description: 'Kamar baru berhasil ditambahkan.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Gagal menyimpan kamar',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="room ? 'Edit Kamar' : 'Tambah Kamar Baru'">
    <template #description>
      <span class="text-sm text-gray-500">
        {{ room ? 'Perbarui informasi kamar' : 'Isi form untuk menambahkan kamar baru' }}
      </span>
    </template>
    
    <template #content>
      <div class="p-6">
        <!-- Occupied Room Banner -->
        <div v-if="isOccupied && room" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div class="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
            <span class="text-sm font-medium">
              Kamar ditempati oleh <strong>{{ room.tenantName || 'Penghuni tidak diketahui' }}</strong>
            </span>
          </div>
          <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Untuk mengganti penghuni atau mengosongkan kamar, gunakan halaman "Kelola".
          </p>
        </div>

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Properti</label>
            <USelect 
              v-model="state.propertyId" 
              :items="propertyOptions"
              value-key="value"
              label-key="label"
              placeholder="Pilih properti"
              :disabled="!!room"
              class="w-full"
            />
            <p v-if="room" class="text-xs text-gray-500">Properti tidak dapat diubah setelah kamar dibuat</p>
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama/Nomor Kamar</label>
            <UInput v-model="state.name" placeholder="cth. 101" autofocus class="w-full" />
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Harga Kamar (Bulanan)</label>
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
              Status tidak dapat diubah saat kamar terisi.
            </p>
          </div>

          <div class="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Konfigurasi Utilitas</h4>
                <p class="text-xs text-gray-500">Urutan fallback: kamar, properti, lalu global.</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Tarif Khusus</span>
                <USwitch v-model="state.overrideSettings" />
              </div>
            </div>

            <div v-if="!state.overrideSettings" class="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-sm text-gray-500">
              Kamar ini mengikuti pengaturan turunan.
              <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div class="bg-white dark:bg-gray-800 p-1 rounded border">Listrik: {{ inheritedSettings.costPerKwh }}</div>
                <div class="bg-white dark:bg-gray-800 p-1 rounded border">Air: {{ inheritedSettings.waterFee }}</div>
                <div class="bg-white dark:bg-gray-800 p-1 rounded border">Sampah: {{ inheritedSettings.trashFee }}</div>
              </div>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <div class="flex justify-end gap-3 mt-6">
            <UButton label="Batal" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Simpan Kamar" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

