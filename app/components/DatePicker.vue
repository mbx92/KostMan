<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  granularity?: 'day' | 'month'
}>(), {
  granularity: 'day'
})

const emit = defineEmits(['update:modelValue'])

const date = ref<CalendarDate | null>(null)

// Sync from string prop to CalendarDate
watch(() => props.modelValue, (val) => {
  if (val) {
     let parts = val.split('-')
     // Handle YYYY-MM for month granularity
     if (props.granularity === 'month' && parts.length === 2) {
         parts.push('01')
     }

     if (parts.length === 3) {
         try {
            date.value = new CalendarDate(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]))
         } catch (e) {
            console.error('Invalid date format', val)
         }
         return
     }
  }
  date.value = null
}, { immediate: true })

// Sync from CalendarDate to string prop
watch(date, (val) => {
  if (val) {
    // Always emit full date string (YYYY-MM-DD) to preserve day selection
    emit('update:modelValue', val.toString())
  } else {
    emit('update:modelValue', null)
  }
})

const formattedDate = computed(() => {
  if (!props.modelValue) return 'Semua Periode'
  try {
    const [year, month, day] = props.modelValue.split('-').map(Number)
    // Handle YYYY-MM cases where day is undefined
    const dateObj = new Date(year, month - 1, day || 1)
    
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj)
  } catch (e) {
    return props.modelValue
  }
})
</script>

<template>
  <UPopover :popper="{ placement: 'bottom-start' }">
    <UButton 
        icon="i-heroicons-calendar" 
        color="neutral" 
        variant="soft" 
        :label="formattedDate" 
        :ui="{ base: 'w-40 justify-start' }"
    />
    
    <template #content="{ close }">
      <div class="p-2 space-y-2">
         <div class="flex justify-end">
             <UButton 
                v-if="date" 
                size="xs" 
                color="neutral" 
                variant="ghost" 
                label="Clear" 
                @click="date = null; close()" 
             />
         </div>
         <UCalendar v-model="date" @close="close" />
      </div>
    </template>
  </UPopover>
</template>
