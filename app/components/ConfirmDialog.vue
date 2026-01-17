<script setup lang="ts">
/**
 * useConfirmDialog - A composable for custom confirmation dialogs
 * Usage:
 * const { confirm, ConfirmDialog } = useConfirmDialog()
 * 
 * // In template: <ConfirmDialog />
 * // In script: const confirmed = await confirm({ title: 'Delete?', message: 'Are you sure?' })
 */

const isOpen = ref(false)
const resolvePromise = ref<((value: boolean) => void) | null>(null)

const dialogConfig = ref({
  title: 'Konfirmasi',
  message: 'Apakah Anda yakin?',
  confirmText: 'Ya',
  cancelText: 'Batal',
  confirmColor: 'error' as 'error' | 'primary' | 'success' | 'warning'
})

interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: 'error' | 'primary' | 'success' | 'warning'
}

const confirm = (options: ConfirmOptions = {}): Promise<boolean> => {
  dialogConfig.value = {
    title: options.title || 'Konfirmasi',
    message: options.message || 'Apakah Anda yakin?',
    confirmText: options.confirmText || 'Ya',
    cancelText: options.cancelText || 'Batal',
    confirmColor: options.confirmColor || 'error'
  }
  
  isOpen.value = true
  
  return new Promise((resolve) => {
    resolvePromise.value = resolve
  })
}

const handleConfirm = () => {
  isOpen.value = false
  resolvePromise.value?.(true)
  resolvePromise.value = null
}

const handleCancel = () => {
  isOpen.value = false
  resolvePromise.value?.(false)
  resolvePromise.value = null
}

defineExpose({ confirm })
</script>

<template>
  <UModal :open="isOpen" @close="handleCancel">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 class="font-semibold text-lg">{{ dialogConfig.title }}</h3>
          </div>
        </template>
        
        <p class="text-gray-600 dark:text-gray-300">{{ dialogConfig.message }}</p>
        
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="handleCancel">
              {{ dialogConfig.cancelText }}
            </UButton>
            <UButton :color="dialogConfig.confirmColor" @click="handleConfirm">
              {{ dialogConfig.confirmText }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
