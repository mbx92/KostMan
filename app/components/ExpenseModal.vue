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
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(3, 'Description is too short'),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['property', 'global']),
  expenseDate: z.string().min(1, 'Expense date is required'),
  paidDate: z.string().optional(),
  isPaid: z.boolean(),
  paymentMethod: z.string().optional(),
  receiptUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notes: z.string().optional()
}).refine(data => {
  if (data.type === 'property' && !data.propertyId) {
    return false
  }
  return true
}, {
  message: 'Property is required for property expenses',
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
  { value: 'property', label: 'Property Expense' },
  { value: 'global', label: 'Global Expense' }
]

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
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
        title: 'Expense Updated',
        description: 'Expense has been updated successfully.',
        color: 'success',
      })
    } else {
      await $fetch('/api/expenses', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Expense Created',
        description: 'New expense has been added successfully.',
        color: 'success',
      })
    }
    
    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message || err?.message || 'Failed to save expense',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="expense ? 'Edit Expense' : 'Add New Expense'">
    <template #default />
    
    <template #content>
      <div class="p-6 max-h-[80vh] overflow-y-auto">
        <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
          
          <div class="space-y-4">
            <h3 class="font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-800">Expense Details</h3>
            
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <USelect 
                v-model="state.type" 
                :items="typeOptions" 
                value-key="value" 
                label-key="label"
                class="w-full"
              />
            </div>

            <div v-if="state.type === 'property'" class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Property</label>
              <USelect 
                v-model="state.propertyId" 
                :items="propertyOptions" 
                value-key="value" 
                label-key="label"
                placeholder="Select property"
                class="w-full"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <USelect 
                v-model="state.category" 
                :items="categoryOptions" 
                value-key="value" 
                label-key="label"
                placeholder="Select category"
                class="w-full"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <UTextarea v-model="state.description" placeholder="e.g. AC repair in Room 101" class="w-full" />
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
              <UInput v-model="state.amount" type="number" step="0.01" placeholder="0.00" class="w-full">
                <template #leading>Rp</template>
              </UInput>
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Expense Date</label>
              <UInput v-model="state.expenseDate" type="date" class="w-full" />
            </div>
          </div>

          <!-- Payment Details -->
          <div class="space-y-4">
            <div class="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
              <h3 class="font-medium text-gray-900 dark:text-white">Payment Details</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Paid</span>
                <USwitch v-model="state.isPaid" />
              </div>
            </div>

            <div v-if="state.isPaid" class="space-y-4 animate-fade-in">
              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Paid Date</label>
                <UInput v-model="state.paidDate" type="date" class="w-full" />
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                <USelect 
                  v-model="state.paymentMethod" 
                  :items="paymentMethods" 
                  value-key="value" 
                  label-key="label"
                  placeholder="Select payment method"
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- Additional Info -->
          <div class="space-y-4">
            <h3 class="font-medium text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-800">Additional Information</h3>
            
            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Receipt URL</label>
              <UInput v-model="state.receiptUrl" placeholder="https://..." class="w-full" />
              <p class="text-xs text-gray-500 mt-1">Link to receipt image or PDF</p>
            </div>

            <div class="space-y-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
              <UTextarea v-model="state.notes" placeholder="Additional notes..." class="w-full" />
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton label="Cancel" color="neutral" variant="ghost" :disabled="isSaving" @click="isOpen = false" />
            <UButton type="submit" label="Save Expense" color="primary" :loading="isSaving" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
