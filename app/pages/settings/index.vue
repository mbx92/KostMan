<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import { useKosStore } from '~/stores/kos'

const store = useKosStore()
const { settings, integrations, settingsLoading, integrationsLoading } = storeToRefs(store)
const toast = useToast()

// --- Global Settings ---
const state = reactive({
  appName: '',
  costPerKwh: 0,
  waterFee: 0,
  trashFee: 0
})

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

// Initialize data
onMounted(async () => {
  await Promise.all([
    store.fetchSettings(),
    store.fetchIntegrations()
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

    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center gap-4 text-sm text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
        <UIcon name="i-heroicons-information-circle" class="w-5 h-5 shrink-0" />
        <p>Global billing rates are used as defaults when creating new properties. You can override these rates in specific property settings.</p>
    </div>
  </div>
</template>
