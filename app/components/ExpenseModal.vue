<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

interface Expense {
  id: string
  propertyId?: string
  propertyName?: string
  category: string
  description: string
  amount: string
  type: 'property' | 'global'
  expenseDate: string
  paidDate?: string
  isPaid: boolean
  paymentMethod?: string
  receiptUrl?: string
  notes?: string
}

const props = defineProps<{
  modelValue: boolean
  expense?: Expense
  properties: any[]
  categories: any[]
}>()

const emit = defineEmits(['update:modelValue', 'saved'])

const toast = useToast()
const isSaving = ref(false)

const state = reactive({
  propertyId: '',
  category: '',
  description: '',
  amount: 0,
  type: 'property' as 'property' | 'global',
  expenseDate: new Date().toISOString().split('T')[0],
  paidDate: '',
  isPaid: false,
  paymentMethod: '',
  receiptUrl: '',
  notes: ''
})



// Computed options for USelect (mapping to label/value for reliability)
const propertyOptions = computed(() => {
  return props.properties.map(p => ({
    label: p.name,
    value: p.id
  }))
})

const categoryOptions = computed(() => {
  return props.categories.map(c => ({
    label: c.name,
    value: c.name
  }))
})


// Validation Schema
const schema = z.object({
  propertyId: z.string().optional(),
  category: z.string().min(1, 'Kategori wajib diisi'),
  description: z.string().min(3, 'Deskripsi terlalu pendek'),
  amount: z.number().positive('Jumlah harus positif'),
  type: z.enum(['property', 'global']),
  expenseDate: z.string().min(1, 'Tanggal pengeluaran wajib diisi'),
  paidDate: z.string().optional(),
  isPaid: z.boolean(),
  paymentMethod: z.string().optional(),
  receiptUrl: z.string().url('Harus berupa URL yang valid').optional().or(z.literal('')),
  notes: z.string().optional()
}).refine(data => {
  if (data.type === 'property' && !data.propertyId) {
    return false
  }
  return true
}, {
  message: 'Properti wajib dipilih untuk pengeluaran properti',
  path: ['propertyId']
})

type Schema = z.output<typeof schema>

// Sync with prop for Edit Mode
watch(() => props.expense, (newVal) => {
  if (newVal) {
    state.propertyId = newVal.propertyId || ''
    state.category = newVal.category
    state.description = newVal.description
    state.amount = parseFloat(newVal.amount)
    state.type = newVal.type
    state.expenseDate = newVal.expenseDate
    state.paidDate = newVal.paidDate || ''
    state.isPaid = newVal.isPaid
    state.paymentMethod = newVal.paymentMethod || ''
    state.receiptUrl = newVal.receiptUrl || ''
    state.notes = newVal.notes || ''
  } else {
    // Reset for Add Mode
    state.propertyId = ''
    state.category = ''
    state.description = ''
    state.amount = 0
    state.type = 'property'
    state.expenseDate = new Date().toISOString().split('T')[0]
    state.paidDate = ''
    state.isPaid = false
    state.paymentMethod = ''
    state.receiptUrl = ''
    state.notes = ''
  }
}, { immediate: true })

// Auto-clear propertyId when type is global
watch(() => state.type, (newType) => {
  if (newType === 'global') {
    state.propertyId = ''
  }
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const typeOptions = [
  { value: 'property', label: 'Pengeluaran Properti' },
  { value: 'global', label: 'Pengeluaran Global' }
]

const paymentMethods = [
  { value: 'cash', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'credit_card', label: 'Kartu Kredit' },
  { value: 'debit_card', label: 'Kartu Debit' },
  { value: 'e_wallet', label: 'E-Wallet' }
]

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  const data = event.data
  
  isSaving.value = true
  
  try {
    const payload = {
      ...data,
      propertyId: data.type === 'global' ? null : data.propertyId,
      paidDate: data.paidDate || null,
      paymentMethod: data.paymentMethod || null,
      receiptUrl: data.receiptUrl || null,
      notes: data.notes || null
    }
    
    if (props.expense) {
      await $fetch(`/api/expenses/${props.expense.id}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({
        title: 'Pengeluaran Diperbarui',
        description: 'Pengeluaran berhasil diperbarui.',
        color: 'success',
      })
    } else {
      await $fetch('/api/expenses', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Pengeluaran Dibuat',
        description: 'Pengeluaran baru berhasil ditambahkan.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Gagal',
      description: err?.data?.message || err?.message || 'Gagal menyimpan pengeluaran',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="expense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'">
    <template #default />
    
    <template #content>
      <div class="p-6 max-h-[80vh] overflow-y-auto">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          
          <div class="space-y-4">
            <h3 class="font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-800">Rincian Pengeluaran</h3>
            
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipe</label>
              <USelect 
                v-model="state.type" 
                :items="typeOptions" 
                value-key="value" 
                label-key="label"
                class="w-full"
              />
            </div>

            <div v-if="state.type === 'property'" class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Properti</label>
              <USelect 
                v-model="state.propertyId" 
                :items="propertyOptions" 
                value-key="value" 
                label-key="label"
                placeholder="Pilih properti"
                class="w-full"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Kategori</label>
              <USelect 
                v-model="state.category" 
                :items="categoryOptions" 
                value-key="value" 
                label-key="label"
                placeholder="Pilih kategori"
                class="w-full"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi</label>
              <UTextarea v-model="state.description" placeholder="contoh: Perbaikan AC di Kamar 101" class="w-full" />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Jumlah</label>
              <UInput v-model="state.amount" type="number" step="0.01" placeholder="0.00" class="w-full">
                <template #leading>Rp</template>
              </UInput>
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Pengeluaran</label>
              <DatePicker v-model="state.expenseDate" granularity="day" class="w-full" />
            </div>
          </div>

          <!-- Payment Details -->
          <div class="space-y-4">
            <div class="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
              <h3 class="font-medium text-gray-900 dark:text-white">Rincian Pembayaran</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Lunas</span>
                <USwitch v-model="state.isPaid" />
              </div>
            </div>

            <div v-if="state.isPaid" class="space-y-4 animate-fade-in">
              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Bayar</label>
                <DatePicker v-model="state.paidDate" granularity="day" class="w-full" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Metode Pembayaran</label>
                <USelect 
                  v-model="state.paymentMethod" 
                  :items="paymentMethods" 
                  value-key="value" 
                  label-key="label"
                  placeholder="Pilih metode pembayaran"
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- Additional Info -->
          <div class="space-y-4">
            <h3 class="font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-800">Informasi Tambahan</h3>
            
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">URL Kuitansi</label>
              <UInput v-model="state.receiptUrl" placeholder="https://..." class="w-full" />
              <p class="text-xs text-gray-500 mt-1">Tautan ke gambar atau PDF kuitansi</p>
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Catatan</label>
              <UTextarea v-model="state.notes" placeholder="Catatan tambahan..." class="w-full" />
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton label="Batal" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Simpan Pengeluaran" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
