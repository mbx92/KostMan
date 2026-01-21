<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import { useKosStore } from '~/stores/kos'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

const store = useKosStore()
const { settings, integrations, settingsLoading, integrationsLoading } = storeToRefs(store)
const toast = useToast()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

// --- Global Settings ---
const state = reactive({
  appName: '',
  costPerKwh: 0,
  waterFee: 0,
  trashFee: 0
})

// --- WhatsApp Template State ---
const whatsappTemplates = ref<any[]>([])
const importingTemplates = ref(false)
const templateFormOpen = ref(false)
const editingTemplate = ref<any>(null)
const templateForm = reactive({
  name: '',
  message: '',
  templateType: 'general' as 'billing' | 'reminder_overdue' | 'reminder_due_soon' | 'general',
  isDefault: false
})
const templateLoading = ref(false)

const templateTypeOptions = [
  { label: 'Umum', value: 'general' },
  { label: 'Tagihan Bulanan', value: 'billing' },
  { label: 'Reminder Overdue', value: 'reminder_overdue' },
  { label: 'Reminder Jatuh Tempo', value: 'reminder_due_soon' }
]

const schema = z.object({
  appName: z.string().min(1, 'App Name is required'),
  costPerKwh: z.number().min(0),
  waterFee: z.number().min(0),
  trashFee: z.number().min(0)
})

type Schema = z.output<typeof schema>

// --- Integration State ---
const midtransState = reactive({
  isEnabled: false,
  serverKey: '',
  clientKey: '',
  isProduction: false
})

// Initialize data - consolidated in single onMounted below

const onSubmitGlobal = async (event: FormSubmitEvent<Schema>) => {
  try {
    await store.saveSettings(event.data)
    toast.add({ title: 'Settings Saved', description: 'Global settings have been updated.', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to save settings.', color: 'error' })
  }
}

const onSaveMidtrans = async () => {
  try {
    await store.saveIntegration('midtrans', midtransState)
    toast.add({ title: 'Integration Saved', description: 'Midtrans settings updated.', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to save integration.', color: 'error' })
  }
}

// --- Backup Functions ---
const backupLoading = ref(false)
const backupHistory = ref<any[]>([])
const showHistory = ref(false)

async function createBackup() {
  backupLoading.value = true
  try {
    const response = await $fetch('/api/backup/database', {
      method: 'POST',
      responseType: 'blob',
    })
    
    // Trigger download
    const url = window.URL.createObjectURL(response as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kostman-backup-${new Date().toISOString().split('T')[0]}.sql`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.add({
      title: 'Backup Berhasil',
      description: 'Database berhasil di-backup dan diunduh.',
      color: 'success',
    })
    
    // Refresh history
    await loadBackupHistory()
  } catch (error: any) {
    toast.add({
      title: 'Backup Gagal',
      description: error.data?.message || 'Gagal membuat backup',
      color: 'error',
    })
  } finally {
    backupLoading.value = false
  }
}

async function loadBackupHistory() {
  try {
    const data = await $fetch('/api/backup/history')
    backupHistory.value = data.backups
  } catch (error) {
    console.error('Failed to load backup history', error)
  }
}

async function cleanupOldBackups() {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Backup Lama?',
    message: 'Hapus backup yang lebih lama dari 30 hari?',
    confirmText: 'Ya, Hapus',
    confirmColor: 'warning',
  })
  
  if (!confirmed) return
  
  try {
    const result = await $fetch('/api/backup/cleanup', { method: 'POST' })
    toast.add({
      title: 'Berhasil',
      description: result.message,
      color: 'success',
    })
    await loadBackupHistory()
  } catch (error) {
    toast.add({
      title: 'Gagal',
      description: 'Gagal membersihkan backup lama',
      color: 'error',
    })
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// --- WhatsApp Template Functions ---
async function loadWhatsAppTemplates() {
  try {
    const data = await $fetch('/api/whatsapp-templates')
    whatsappTemplates.value = data.templates
  } catch (error) {
    console.error('Failed to load WhatsApp templates', error)
  }
}

function openTemplateForm(template?: any) {
  if (template) {
    editingTemplate.value = template
    templateForm.name = template.name
    templateForm.message = template.message
    templateForm.templateType = template.templateType || 'general'
    templateForm.isDefault = template.isDefault
  } else {
    editingTemplate.value = null
    templateForm.name = ''
    templateForm.message = getDefaultTemplate()
    templateForm.templateType = 'general'
    templateForm.isDefault = false
  }
  templateFormOpen.value = true
}

function getDefaultTemplate() {
  return `Halo {nama_penyewa},

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran.
Terima kasih.`
}

async function saveTemplate() {
  if (!templateForm.name || !templateForm.message) {
    toast.add({
      title: 'Validasi Gagal',
      description: 'Nama dan pesan template harus diisi',
      color: 'error',
    })
    return
  }

  templateLoading.value = true
  try {
    if (editingTemplate.value) {
      // Update existing
      await $fetch(`/api/whatsapp-templates/${editingTemplate.value.id}`, {
        method: 'PUT',
        body: {
          name: templateForm.name,
          message: templateForm.message,
          templateType: templateForm.templateType,
          isDefault: templateForm.isDefault,
        }
      })
      toast.add({
        title: 'Berhasil',
        description: 'Template berhasil diperbarui',
        color: 'success',
      })
    } else {
      // Create new
      await $fetch('/api/whatsapp-templates', {
        method: 'POST',
        body: {
          name: templateForm.name,
          message: templateForm.message,
          templateType: templateForm.templateType,
          isDefault: templateForm.isDefault,
        }
      })
      toast.add({
        title: 'Berhasil',
        description: 'Template berhasil dibuat',
        color: 'success',
      })
    }
    
    templateFormOpen.value = false
    await loadWhatsAppTemplates()
  } catch (error: any) {
    toast.add({
      title: 'Gagal',
      description: error.data?.message || 'Gagal menyimpan template',
      color: 'error',
    })
  } finally {
    templateLoading.value = false
  }
}

async function deleteTemplate(template: any) {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Template?',
    message: `Hapus template "${template.name}"?`,
    confirmText: 'Ya, Hapus',
    confirmColor: 'error',
  })
  
  if (!confirmed) return
  
  try {
    await $fetch(`/api/whatsapp-templates/${template.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Berhasil',
      description: 'Template berhasil dihapus',
      color: 'success',
    })
    await loadWhatsAppTemplates()
  } catch (error) {
    toast.add({
      title: 'Gagal',
      description: 'Gagal menghapus template',
      color: 'error',
    })
  }
}

function insertVariable(variable: string) {
  templateForm.message += variable
}

async function importTemplates() {
  importingTemplates.value = true
  try {
    const result = await $fetch('/api/whatsapp-templates/seed', {
      method: 'POST'
    })
    toast.add({
      title: 'Berhasil',
      description: result.message || 'Template berhasil diimport',
      color: 'success',
    })
    await loadWhatsAppTemplates()
  } catch (error: any) {
    toast.add({
      title: 'Gagal',
      description: error?.data?.message || 'Gagal mengimport template',
      color: 'error',
    })
  } finally {
    importingTemplates.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchSettings(),
    store.fetchIntegrations(),
    loadBackupHistory(),
    loadWhatsAppTemplates()
  ])
  
  // Sync state with store
  if (settings.value) {
    state.appName = settings.value.appName
    state.costPerKwh = Number(settings.value.costPerKwh)
    state.waterFee = Number(settings.value.waterFee)
    state.trashFee = Number(settings.value.trashFee)
  }

  // Sync integration state
  if (integrations.value?.midtrans) {
    const m = integrations.value.midtrans
    midtransState.isEnabled = m.isEnabled
    midtransState.serverKey = m.serverKey || '' // Will be masked if saved
    midtransState.clientKey = m.clientKey || ''
    midtransState.isProduction = m.isProduction
  }
})
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-10">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage global application configuration and integrations.</p>
    </div>

    <!-- Global Application Settings -->
    <section class="space-y-6">
      <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">General & Billing</h2>
          <p class="text-sm text-gray-500">Application identity and default utility rates.</p>
        </div>
        <UButton :loading="settingsLoading" type="submit" size="md" color="primary" @click="onSubmitGlobal({ data: state } as any)">
          Save Changes
        </UButton>
      </div>

      <UForm :schema="schema" :state="state" @submit="onSubmitGlobal">
        <div class="grid grid-cols-1 gap-6">
          <!-- App Name -->
          <UCard>
            <UFormField label="Application Name" help="This name will appear on the dashboard and generated bills.">
              <UInput v-model="state.appName" placeholder="e.g. Kost Mawar" />
            </UFormField>
          </UCard>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Electricity Card -->
            <div class="relative group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
              <div class="flex-1">
                <div class="flex items-start justify-between mb-4">
                  <div class="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-yellow-600 dark:text-yellow-400">
                    <UIcon name="i-heroicons-bolt" class="w-8 h-8" />
                  </div>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Electricity Rate</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Base cost per kilowatt-hour (kWh).</p>
              </div>
              
              <UFormField label="Cost per kWh" class="mt-auto">
                <UInput v-model="state.costPerKwh" type="number" step="100" size="lg">
                  <template #leading>Rp</template>
                </UInput>
              </UFormField>
            </div>

            <!-- Water Card -->
            <div class="relative group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
              <div class="flex-1">
                <div class="flex items-start justify-between mb-4">
                  <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                    <UIcon name="i-heroicons-beaker" class="w-8 h-8" />
                  </div>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Water Fee</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Flat monthly water charge per room.</p>
              </div>
              
              <UFormField label="Monthly Fee" class="mt-auto">
                <UInput v-model="state.waterFee" type="number" step="1000" size="lg">
                  <template #leading>Rp</template>
                </UInput>
              </UFormField>
            </div>

            <!-- Trash Card -->
            <div class="relative group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
              <div class="flex-1">
                <div class="flex items-start justify-between mb-4">
                  <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                    <UIcon name="i-heroicons-trash" class="w-8 h-8" />
                  </div>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Trash Fee</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Standard monthly trash collection fee.</p>
              </div>
              
              <UFormField label="Monthly Fee" class="mt-auto">
                <UInput v-model="state.trashFee" type="number" step="1000" size="lg">
                  <template #leading>Rp</template>
                </UInput>
              </UFormField>
            </div>
          </div>
        </div>
      </UForm>
    </section>

    <!-- Integrations Section -->
    <section class="space-y-6">
      <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Payment Integrations</h2>
          <p class="text-sm text-gray-500">Configure payment gateways like Midtrans.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Midtrans Card -->
        <UCard class="space-y-4">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                 <div class="bg-gray-900 dark:bg-transparent px-3 py-1.5 rounded-lg">
                   <img src="/midtrans.svg" alt="Midtrans" class="h-5" />
                 </div>
              </div>
              <USwitch v-model="midtransState.isEnabled" />
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Enable automated payments using Midtrans Gateway.
            </p>

            <UFormField label="Server Key" class="w-full">
              <UInput v-model="midtransState.serverKey" type="password" placeholder="Midtrans Server Key" icon="i-heroicons-key" class="w-full" />
            </UFormField>

            <UFormField label="Client Key" class="w-full">
              <UInput v-model="midtransState.clientKey" placeholder="Midtrans Client Key" icon="i-heroicons-key" class="w-full" />
            </UFormField>

            <div class="flex items-center justify-between py-2">
              <div class="text-sm font-medium">Production Mode</div>
              <USwitch v-model="midtransState.isProduction" />
            </div>

            <UButton block color="primary" :loading="integrationsLoading" @click="onSaveMidtrans">
              Save Configuration
            </UButton>
          </div>
        </UCard>
      </div>
    </section>

    <!-- WhatsApp Template Section -->
    <section class="space-y-6">
      <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Template WhatsApp</h2>
          <p class="text-sm text-gray-500">Kelola template pesan untuk reminder pembayaran via WhatsApp.</p>
        </div>
        <div class="flex gap-2">
          <UButton 
            icon="i-heroicons-arrow-down-tray" 
            color="gray" 
            variant="soft"
            :loading="importingTemplates"
            @click="importTemplates"
          >
            Import Template
          </UButton>
          <UButton icon="i-heroicons-plus" color="primary" @click="openTemplateForm()">
            Buat Template
          </UButton>
        </div>
      </div>

      <UCard v-if="whatsappTemplates.length === 0">
        <div class="text-center py-8">
          <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p class="text-gray-500 dark:text-gray-400 mb-4">Belum ada template WhatsApp</p>
          <div class="flex gap-2 justify-center">
            <UButton 
              icon="i-heroicons-arrow-down-tray" 
              variant="soft"
              :loading="importingTemplates"
              @click="importTemplates"
            >
              Import Template Default
            </UButton>
            <UButton icon="i-heroicons-plus" @click="openTemplateForm()">
              Buat Template Pertama
            </UButton>
          </div>
        </div>
      </UCard>

      <div v-else class="grid grid-cols-1 gap-4">
        <UCard 
          v-for="template in whatsappTemplates" 
          :key="template.id"
          class="hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="font-semibold text-gray-900 dark:text-white">
                  {{ template.name }}
                </h3>
                <UBadge v-if="template.isDefault" color="primary" size="xs">
                  Default
                </UBadge>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg font-mono text-xs max-h-40 overflow-y-auto">
                {{ template.message }}
              </div>
              <p class="text-xs text-gray-500 mt-2">
                Dibuat: {{ new Date(template.createdAt).toLocaleString('id-ID') }}
              </p>
            </div>
            <div class="flex gap-2">
              <UButton 
                icon="i-heroicons-pencil" 
                size="sm" 
                color="neutral" 
                variant="soft"
                @click="openTemplateForm(template)"
              />
              <UButton 
                icon="i-heroicons-trash" 
                size="sm" 
                color="error" 
                variant="soft"
                @click="deleteTemplate(template)"
              />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Info Card -->
      <UCard class="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div class="flex gap-3">
          <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div class="text-sm text-blue-700 dark:text-blue-300 space-y-2">
            <p><strong>Variabel yang Tersedia:</strong></p>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
              <div><code>{nama_penyewa}</code> - Nama penghuni</div>
              <div><code>{nama_properti}</code> - Nama properti</div>
              <div><code>{nama_kamar}</code> - Nama kamar</div>
              <div><code>{jumlah_tagihan}</code> - Total tagihan</div>
              <div><code>{tanggal_jatuh_tempo}</code> - Tgl jatuh tempo</div>
              <div><code>{status_tagihan}</code> - Status tagihan</div>
              <div><code>{periode}</code> - Periode billing</div>
            </div>
            <p class="pt-2">Gunakan variabel di atas dalam template untuk data yang dinamis.</p>
          </div>
        </div>
      </UCard>
    </section>

    <!-- System Logs Section -->
    <section class="space-y-6">
      <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">System Logs</h2>
          <p class="text-sm text-gray-500">View application logs and manage log retention.</p>
        </div>
      </div>

      <UCard class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-gray-900 dark:text-white">View System Logs</h3>
          <p class="text-sm text-gray-500 mt-1 mb-2">Monitor API requests, errors, and system events.</p>
        </div>
        <UButton to="/settings/logs" icon="i-heroicons-document-text" variant="soft">
          Open Logs
        </UButton>
      </UCard>
    </section>

    <!-- Database Backup Section -->
    <section class="space-y-6">
      <div class="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Database Backup</h2>
          <p class="text-sm text-gray-500">Backup dan restore data aplikasi Anda.</p>
        </div>
      </div>

      <UCard>
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Backup seluruh data aplikasi termasuk properti, kamar, penghuni, tagihan, dan pembayaran.
            File backup akan diunduh dalam format SQL.
          </p>
          
          <div class="flex flex-wrap gap-3">
            <UButton 
              color="primary" 
              icon="i-heroicons-arrow-down-tray"
              :loading="backupLoading"
              @click="createBackup"
            >
              Backup Sekarang
            </UButton>
            
            <UButton 
              v-if="backupHistory.length > 0"
              variant="soft"
              icon="i-heroicons-clock"
              @click="showHistory = !showHistory"
            >
              {{ showHistory ? 'Sembunyikan' : 'Lihat' }} Riwayat ({{ backupHistory.length }})
            </UButton>
            
            <UButton 
              v-if="backupHistory.length > 0"
              variant="soft"
              color="warning"
              icon="i-heroicons-trash"
              @click="cleanupOldBackups"
            >
              Bersihkan Lama
            </UButton>
          </div>
          
          <!-- Backup History -->
          <div v-if="showHistory && backupHistory.length > 0" class="mt-6">
            <div class="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Riwayat Backup
              </h4>
              
              <div class="space-y-2">
                <div 
                  v-for="backup in backupHistory" 
                  :key="backup.id"
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <UIcon 
                        :name="backup.type === 'manual' ? 'i-heroicons-hand-raised' : 'i-heroicons-clock'" 
                        class="w-4 h-4 text-gray-400"
                      />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ backup.filename }}
                      </span>
                      <UBadge 
                        :color="backup.type === 'manual' ? 'primary' : 'neutral'" 
                        size="xs"
                      >
                        {{ backup.type }}
                      </UBadge>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {{ formatFileSize(backup.size) }} • 
                      {{ new Date(backup.createdAt).toLocaleString('id-ID') }}
                      <span v-if="backup.duration"> • {{ (backup.duration / 1000).toFixed(2) }}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div class="flex gap-2">
              <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div class="text-sm text-blue-700 dark:text-blue-300">
                <strong>Tips:</strong> Simpan backup secara berkala di tempat yang aman. 
                File SQL dapat di-restore menggunakan tools seperti pgAdmin atau psql.
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </section>

    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center gap-4 text-sm text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
        <UIcon name="i-heroicons-information-circle" class="w-5 h-5 shrink-0" />
        <p>Global billing rates are used as defaults when creating new properties. You can override these rates in specific property settings.</p>
    </div>
    
    <ConfirmDialog ref="confirmDialog" />
    
    <!-- WhatsApp Template Modal -->
    <UModal v-model:open="templateFormOpen" :title="editingTemplate ? 'Edit Template' : 'Buat Template Baru'">
      <template #default />
      
      <template #content>
        <div class="p-6 space-y-4 max-w-3xl">
          <UFormField label="Jenis Template">
            <USelect 
              v-model="templateForm.templateType" 
              :items="templateTypeOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Nama Template" required>
            <UInput 
              v-model="templateForm.name" 
              placeholder="Contoh: Reminder Pembayaran Bulanan"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Pesan Template" required>
            <UTextarea 
              v-model="templateForm.message" 
              :rows="10"
              placeholder="Tulis template pesan di sini..."
              class="w-full font-mono text-sm"
            />
          </UFormField>

          <!-- Quick Insert Variables -->
          <div class="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sisipkan Variabel:
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton 
                v-for="variable in [
                  '{nama_penyewa}',
                  '{detail_tagihan}',
                  '{link_pembayaran}'
                ]"
                :key="variable"
                size="xs"
                color="primary"
                variant="soft"
                @click="insertVariable(variable)"
              >
                {{ variable }}
              </UButton>
            </div>
          </div>

          <div class="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">Jadikan Template Default</p>
              <p class="text-xs text-gray-500">Template ini akan digunakan secara otomatis</p>
            </div>
            <USwitch v-model="templateForm.isDefault" />
          </div>

          <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <UButton 
              color="neutral" 
              variant="soft" 
              @click="templateFormOpen = false"
            >
              Batal
            </UButton>
            <UButton 
              color="primary" 
              :loading="templateLoading"
              @click="saveTemplate"
            >
              {{ editingTemplate ? 'Perbarui' : 'Simpan' }} Template
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
