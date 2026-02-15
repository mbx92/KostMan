<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

definePageMeta({
  layout: 'default'
})

const toast = useToast()

// State
const config = ref<{
  activeEnvironment: string
  environments: {
    development?: { url: string; masked: string }
    staging?: { url: string; masked: string }
    production?: { url: string; masked: string }
  }
}>({
  activeEnvironment: 'development',
  environments: {}
})

const loading = ref(false)
const switchingEnvironment = ref(false)

// Form state
const formState = reactive({
  development: '',
  staging: '',
  production: ''
})

const showPasswords = reactive({
  development: false,
  staging: false,
  production: false
})

// Schema
const schema = z.object({
  development: z.string().url('Invalid database URL').optional().or(z.literal('')),
  staging: z.string().url('Invalid database URL').optional().or(z.literal('')),
  production: z.string().url('Invalid database URL').optional().or(z.literal(''))
})

type Schema = z.output<typeof schema>

// Environment badge colors
const environmentColors: Record<string, any> = {
  development: { color: 'primary', icon: 'i-heroicons-code-bracket' },
  staging: { color: 'warning', icon: 'i-heroicons-beaker' },
  production: { color: 'error', icon: 'i-heroicons-server' }
}

// Load configuration
const loadConfig = async () => {
  loading.value = true
  try {
    const response = await $fetch('/api/database-config', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    config.value = response as any

    // Populate form with actual URLs for editing
    formState.development = response.environments.development?.url || ''
    formState.staging = response.environments.staging?.url || ''
    formState.production = response.environments.production?.url || ''
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to load database configuration',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Save configuration
const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true
  try {
    // Only send non-empty values
    const payload: any = {}
    if (event.data.development) payload.development = event.data.development
    if (event.data.staging) payload.staging = event.data.staging
    if (event.data.production) payload.production = event.data.production

    await $fetch('/api/database-config', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: payload
    })

    toast.add({
      title: 'Success',
      description: 'Database configuration updated successfully',
      color: 'success'
    })

    await loadConfig()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update database configuration',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Switch environment
const switchEnvironment = async (environment: string, autoRestart = true) => {
  switchingEnvironment.value = true
  try {
    const response = await $fetch('/api/database-config/switch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: { environment }
    })

    toast.add({
      title: 'Environment Switched',
      description: (response as any).message,
      color: 'success'
    })

    config.value.activeEnvironment = environment

    // Check if running on Windows in dev mode
    const isWindowsDev = (response as any).platform === 'win32' && (response as any).env === 'development'

    if (autoRestart && !isWindowsDev) {
      // Auto-restart server to apply changes (only on Linux/production)
      toast.add({
        title: 'Restarting Server',
        description: '.env file updated. Server will restart automatically...',
        color: 'info'
      })

      // Wait a moment for user to see the message
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Trigger restart
      await restartServer()
    } else {
      // Manual restart required (Windows dev mode or autoRestart=false)
      const message = isWindowsDev 
        ? '.env file has been updated. Please manually restart the server with: npm run dev'
        : '.env file has been updated. Click "Restart Server" button below to apply changes.'
      
      toast.add({
        title: 'Manual Restart Required',
        description: message,
        color: 'warning',
        timeout: 8000
      })
    }
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to switch environment',
      color: 'error'
    })
  } finally {
    switchingEnvironment.value = false
  }
}

// Display URL (masked or unmasked)
const displayUrl = (env: string) => {
  const envData = config.value.environments[env as keyof typeof config.value.environments]
  if (!envData) return 'Not configured'
  
  return showPasswords[env as keyof typeof showPasswords] 
    ? envData.url 
    : envData.masked
}

// Check if database name matches the expected pattern for the environment
const shouldShowMismatchWarning = () => {
  if (!dbInfo.value?.connection?.database) return false
  
  const currentDb = dbInfo.value.connection.database.toLowerCase()
  const env = config.value.activeEnvironment.toLowerCase()
  
  // Expected patterns: kostMan_dev, kostMan_staging, kostMan_prod (or kostman_production)
  const expectedPatterns = [
    `kostman_${env}`,
    `kostMan_${env}`,
    env === 'development' ? 'kostman_dev' : null,
    env === 'development' ? 'kostMan_dev' : null,
    env === 'staging' ? 'kostman_staging' : null,
    env === 'staging' ? 'kostMan_staging' : null,
    env === 'production' ? 'kostman_prod' : null,
    env === 'production' ? 'kostMan_prod' : null,
    env === 'production' ? 'kostman_production' : null,
    env === 'production' ? 'kostMan_production' : null,
  ].filter(Boolean) as string[]
  
  // If database matches any expected pattern, no warning
  return !expectedPatterns.some(pattern => currentDb === pattern.toLowerCase())
}

// Database copy functionality
const copyingDatabase = ref(false)
const copyForm = reactive({
  sourceDb: 'kostMan_dev',
  targetDb: 'kostman_prod'
})

const copyDatabase = async (withRestart = false) => {
  if (!copyForm.sourceDb || !copyForm.targetDb) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter both source and target database names',
      color: 'error'
    })
    return
  }

  if (copyForm.sourceDb === copyForm.targetDb) {
    toast.add({
      title: 'Validation Error',
      description: 'Source and target database cannot be the same',
      color: 'error'
    })
    return
  }

  copyingDatabase.value = true
  
  try {
    if (withRestart) {
      // Step 1: Restart to close connections
      toast.add({
        title: 'Step 1/2: Restarting Server',
        description: 'Closing database connections...',
        color: 'info'
      })
      
      await $fetch('/api/system/restart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }).catch(() => {
        // Expected - server is restarting
      })
      
      // Wait for server to restart
      toast.add({
        title: 'Waiting for Server',
        description: 'Server is restarting... Please wait.',
        color: 'warning'
      })
      
      await new Promise(resolve => setTimeout(resolve, 8000))
      
      // Try to reconnect
      let reconnected = false
      for (let i = 0; i < 10; i++) {
        try {
          await $fetch('/api/database-config', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          })
          reconnected = true
          break
        } catch {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      if (!reconnected) {
        toast.add({
          title: 'Server Restart Timeout',
          description: 'Please refresh the page and try copy again',
          color: 'warning'
        })
        copyingDatabase.value = false
        return
      }
      
      toast.add({
        title: 'Step 2/2: Copying Database',
        description: 'Starting database copy...',
        color: 'info'
      })
    }
    
    const response = await $fetch('/api/database-config/copy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: {
        sourceDb: copyForm.sourceDb,
        targetDb: copyForm.targetDb,
        forceDisconnect: true
      }
    })

    toast.add({
      title: 'Success',
      description: (response as any).message || 'Database copied successfully',
      color: 'success'
    })

    // Reload config
    await loadConfig()
  } catch (error: any) {
    const errorMsg = error.data?.message || 'Failed to copy database'
    
    toast.add({
      title: 'Error',
      description: errorMsg,
      color: 'error'
    })
    
    // If error mentions active connections, suggest restart
    if (errorMsg.includes('being accessed') || errorMsg.includes('connections')) {
      toast.add({
        title: 'Suggestion',
        description: 'Try using "Restart & Copy" button to close all connections first',
        color: 'warning'
      })
    }
  } finally {
    copyingDatabase.value = false
  }
}

// Server restart functionality
const restartingServer = ref(false)

const restartServer = async () => {
  restartingServer.value = true
  try {
    const response = await $fetch('/api/system/restart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    }) as any

    // Check if restart is not supported (Windows dev mode)
    if (response.cannotRestart) {
      toast.add({
        title: 'Manual Restart Required',
        description: response.note || 'Please manually restart the server',
        color: 'warning',
        timeout: 10000
      })
      restartingServer.value = false
      return
    }

    toast.add({
      title: 'Server Restarting',
      description: response.message || 'Server is restarting...',
      color: 'success'
    })

    // Show countdown
    setTimeout(() => {
      toast.add({
        title: 'Please Wait',
        description: 'Server is restarting. Page will reload automatically.',
        color: 'info'
      })
    }, 2000)

    // Reload page after restart
    setTimeout(() => {
      window.location.reload()
    }, 5000)
  } catch (error: any) {
    // If error is connection error, server might be restarting
    if (error.message?.includes('fetch')) {
      toast.add({
        title: 'Server Restarting',
        description: 'Connection lost. Page will reload automatically.',
        color: 'info'
      })
      setTimeout(() => {
        window.location.reload()
      }, 5000)
    } else {
      toast.add({
        title: 'Error',
        description: error.data?.message || 'Failed to restart server',
        color: 'error'
      })
      restartingServer.value = false
    }
  }
}

// Initialize
onMounted(() => {
  loadConfig()
  loadDbInfo()
})

// Database connection info
const dbInfo = ref<any>(null)
const loadingDbInfo = ref(false)

const loadDbInfo = async () => {
  loadingDbInfo.value = true
  try {
    const response = await $fetch('/api/system/db-info', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    dbInfo.value = response
  } catch (error) {
    console.error('Failed to load database info:', error)
  } finally {
    loadingDbInfo.value = false
  }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <UButton to="/settings" variant="ghost" icon="i-heroicons-arrow-left" class="mb-4">
        Back to Settings
      </UButton>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Database Configuration</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Manage database connections for different environments
      </p>
    </div>

    <UCard v-if="loading">
      <div class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      </div>
    </UCard>

    <div v-else class="space-y-6">
      <!-- Current Database Connection Info -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-circle-stack" class="w-5 h-5" />
              Current Database Connection
            </h2>
            <UButton
              @click="loadDbInfo"
              :loading="loadingDbInfo"
              size="xs"
              variant="ghost"
              icon="i-heroicons-arrow-path"
            >
              Refresh
            </UButton>
          </div>
        </template>

        <div v-if="dbInfo" class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Connected Database</p>
              <p class="font-semibold text-lg" :class="dbInfo.connection?.database?.includes('prod') ? 'text-red-600' : 'text-blue-600'">
                {{ dbInfo.connection?.database || 'Unknown' }}
              </p>
            </div>
            
            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Database User</p>
              <p class="font-mono text-sm">{{ dbInfo.connection?.user || 'Unknown' }}</p>
            </div>

            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Users</p>
              <p class="font-semibold text-lg">{{ dbInfo.statistics?.users || 0 }}</p>
            </div>

            <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Properties</p>
              <p class="font-semibold text-lg">{{ dbInfo.statistics?.properties || 0 }}</p>
            </div>
          </div>

          <UAlert
            v-if="shouldShowMismatchWarning()"
            icon="i-heroicons-exclamation-triangle"
            color="warning"
            variant="soft"
            title="Database Mismatch Warning"
          >
            <template #description>
              <p class="text-sm">
                Active environment is set to <strong>{{ config.activeEnvironment }}</strong> but connected to <strong>{{ dbInfo.connection?.database }}</strong>.
                <br>
                This usually means the server needs to be restarted to pick up the new DATABASE_URL.
              </p>
            </template>
          </UAlert>

          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p><strong>PostgreSQL:</strong> {{ dbInfo.connection?.postgresql_version }}</p>
            <p><strong>Environment Variable:</strong> {{ dbInfo.environment?.database_from_url }}</p>
          </div>
        </div>

        <div v-else class="text-center py-4 text-gray-500">
          Loading database info...
        </div>
      </UCard>

      <!-- Active Environment Display -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Active Environment</h2>
            <UBadge 
              :color="environmentColors[config.activeEnvironment]?.color || 'gray'" 
              variant="subtle"
              size="lg"
            >
              <UIcon 
                :name="environmentColors[config.activeEnvironment]?.icon || 'i-heroicons-server'" 
                class="w-4 h-4 mr-1"
              />
              {{ config.activeEnvironment.toUpperCase() }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Development -->
            <div 
              class="border dark:border-gray-700 rounded-lg p-4 cursor-pointer transition-all"
              :class="config.activeEnvironment === 'development' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' : 'hover:border-blue-400'"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-code-bracket" class="w-5 h-5 text-blue-500" />
                  <span class="font-semibold text-sm">Development</span>
                </div>
                <UBadge 
                  v-if="config.activeEnvironment === 'development'" 
                  color="primary" 
                  size="xs"
                >
                  Active
                </UBadge>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 break-all">
                {{ config.environments.development?.masked || 'Not configured' }}
              </p>
              <UButton
                v-if="config.activeEnvironment !== 'development' && config.environments.development"
                color="primary"
                variant="soft"
                size="xs"
                block
                :loading="switchingEnvironment"
                @click="() => switchEnvironment('development')"
              >
                Switch & Restart
              </UButton>
            </div>

            <!-- Staging -->
            <div 
              class="border dark:border-gray-700 rounded-lg p-4 cursor-pointer transition-all"
              :class="config.activeEnvironment === 'staging' ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950' : 'hover:border-amber-400'"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-beaker" class="w-5 h-5 text-amber-500" />
                  <span class="font-semibold text-sm">Staging</span>
                </div>
                <UBadge 
                  v-if="config.activeEnvironment === 'staging'" 
                  color="warning" 
                  size="xs"
                >
                  Active
                </UBadge>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 break-all">
                {{ config.environments.staging?.masked || 'Not configured' }}
              </p>
              <UButton
                v-if="config.activeEnvironment !== 'staging' && config.environments.staging"
                color="warning"
                variant="soft"
                size="xs"
                block
                :loading="switchingEnvironment"
                @click="() => switchEnvironment('staging')"
              >
                Switch & Restart
              </UButton>
            </div>

            <!-- Production -->
            <div 
              class="border dark:border-gray-700 rounded-lg p-4 cursor-pointer transition-all"
              :class="config.activeEnvironment === 'production' ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-950' : 'hover:border-red-400'"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-server" class="w-5 h-5 text-red-500" />
                  <span class="font-semibold text-sm">Production</span>
                </div>
                <UBadge 
                  v-if="config.activeEnvironment === 'production'" 
                  color="error" 
                  size="xs"
                >
                  Active
                </UBadge>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 break-all">
                {{ config.environments.production?.masked || 'Not configured' }}
              </p>
              <UButton
                v-if="config.activeEnvironment !== 'production' && config.environments.production"
                color="error"
                variant="soft"
                size="xs"
                block
                :loading="switchingEnvironment"
                @click="() => switchEnvironment('production')"
              >
                Switch & Restart
              </UButton>
            </div>
          </div>

          <UAlert
            icon="i-heroicons-information-circle"
            color="warning"
            variant="soft"
            title="Auto-Restart Enabled"
            description="When you switch environments, the .env file will be updated automatically and the server will restart to apply changes."
          />
        </div>
      </UCard>

      <!-- Configuration Form -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Database Connection URLs</h2>
        </template>

        <UForm :schema="schema" :state="formState" @submit="onSubmit" class="space-y-4">
          <!-- Development -->
          <UFormField 
            label="Development Database" 
            name="development"
            help="PostgreSQL connection URL for development environment"
          >
            <div class="flex gap-2">
              <UInput
                v-model="formState.development"
                :type="showPasswords.development ? 'text' : 'password'"
                placeholder="postgresql://user:password@localhost:5432/dbname"
                class="flex-1"
                icon="i-heroicons-code-bracket"
              />
              <UButton
                :icon="showPasswords.development ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                color="neutral"
                variant="ghost"
                @click="showPasswords.development = !showPasswords.development"
              />
            </div>
          </UFormField>

          <!-- Staging -->
          <UFormField 
            label="Staging Database" 
            name="staging"
            help="PostgreSQL connection URL for staging environment"
          >
            <div class="flex gap-2">
              <UInput
                v-model="formState.staging"
                :type="showPasswords.staging ? 'text' : 'password'"
                placeholder="postgresql://user:password@staging-host:5432/dbname"
                class="flex-1"
                icon="i-heroicons-beaker"
              />
              <UButton
                :icon="showPasswords.staging ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                color="neutral"
                variant="ghost"
                @click="showPasswords.staging = !showPasswords.staging"
              />
            </div>
          </UFormField>

          <!-- Production -->
          <UFormField 
            label="Production Database" 
            name="production"
            help="PostgreSQL connection URL for production environment"
          >
            <div class="flex gap-2">
              <UInput
                v-model="formState.production"
                :type="showPasswords.production ? 'text' : 'password'"
                placeholder="postgresql://user:password@production-host:5432/dbname"
                class="flex-1"
                icon="i-heroicons-server"
              />
              <UButton
                :icon="showPasswords.production ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                color="neutral"
                variant="ghost"
                @click="showPasswords.production = !showPasswords.production"
              />
            </div>
          </UFormField>

          <UAlert
            icon="i-heroicons-shield-exclamation"
            color="error"
            variant="soft"
            title="Security Warning"
            description="Database credentials are encrypted in the database. Only administrators can view and modify these settings."
          />

          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="loadConfig"
            >
              Reset
            </UButton>
            <UButton
              type="submit"
              :loading="loading"
              icon="i-heroicons-check"
            >
              Save Configuration
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- Database Copy Tool -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5" />
              Copy Database
            </h2>
            <UBadge color="info" variant="subtle">Admin Tool</UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Clone an entire database with all its data to a new database. Useful for creating production database from development.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Source Database" help="Database to copy from">
              <UInput
                v-model="copyForm.sourceDb"
                placeholder="kostMan_dev"
                icon="i-heroicons-circle-stack"
              />
            </UFormField>

            <UFormField label="Target Database" help="New database name">
              <UInput
                v-model="copyForm.targetDb"
                placeholder="kostman_prod"
                icon="i-heroicons-circle-stack"
              />
            </UFormField>
          </div>

          <UAlert
            icon="i-heroicons-exclamation-triangle"
            color="warning"
            variant="soft"
            title="Warning"
            description="If target database exists, it will be dropped and recreated. All existing data in target will be lost!"
          />

          <UAlert
            icon="i-heroicons-information-circle"
            color="info"
            variant="soft"
            title="Active Connections Issue?"
          >
            <template #description>
              <p class="text-sm">
                If you get "database is being accessed" error, the source database has active connections. 
                Use <strong>"Restart & Copy"</strong> button below to automatically restart server and copy database.
              </p>
            </template>
          </UAlert>

          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div class="flex gap-2">
              <UButton
                @click="() => copyDatabase(false)"
                :loading="copyingDatabase"
                :disabled="copyingDatabase"
                icon="i-heroicons-document-duplicate"
                color="primary"
              >
                Copy Database
              </UButton>
              <UButton
                @click="() => copyDatabase(true)"
                :loading="copyingDatabase"
                :disabled="copyingDatabase"
                icon="i-heroicons-arrow-path"
                color="warning"
              >
                Restart & Copy
              </UButton>
            </div>
            <p class="text-xs text-gray-500">
              May take a few minutes. "Restart & Copy" recommended if source database is active.
            </p>
          </div>
        </div>
      </UCard>

      <!-- Server Restart Tool -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
              Server Control
            </h2>
            <UBadge color="error" variant="subtle">Careful!</UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Restart the application server to apply database configuration changes or clear cache.
          </p>

          <UAlert
            icon="i-heroicons-information-circle"
            color="info"
            variant="soft"
            title="How it works"
            description="Server will restart automatically if you're using PM2 or systemd. The page will reload after restart."
          />

          <div class="flex items-center gap-3">
            <UButton
              @click="restartServer"
              :loading="restartingServer"
              icon="i-heroicons-arrow-path"
              color="error"
            >
              Restart Server
            </UButton>
            <p class="text-xs text-gray-500">
              Required after switching database environment
            </p>
          </div>
        </div>
      </UCard>

      <!-- Connection URL Format Help -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-information-circle" class="w-5 h-5" />
            Connection URL Format
          </h2>
        </template>

        <div class="space-y-3">
          <div>
            <p class="text-sm font-medium mb-2">PostgreSQL URL Format:</p>
            <code class="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs break-all">
              postgresql://[user]:[password]@[host]:[port]/[database]
            </code>
          </div>

          <div>
            <p class="text-sm font-medium mb-2">Example:</p>
            <code class="block bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs break-all">
              postgresql://kostman_user:MySecurePass123@localhost:5432/kostman_db
            </code>
          </div>

          <UAlert
            icon="i-heroicons-light-bulb"
            color="info"
            variant="soft"
            title="Tip"
            description="You can test database connections by switching to an environment and checking if the application works correctly."
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
