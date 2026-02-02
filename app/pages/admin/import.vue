<template>
  <UContainer class="py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Import Data Excel
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Import properties, rooms, dan tenants dari file Excel
      </p>
    </div>

    <!-- Stepper -->
    <UStepper
      v-model="currentStep"
      :items="steps"
      class="mb-8"
      :prevent-navigation="isProcessing"
    />

    <!-- Step Content -->
    <UCard>
      <!-- Step 1: Upload File -->
      <div v-if="currentStep === 1" class="p-6">
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Upload File Excel</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Upload file Excel dengan format yang sesuai template
          </p>
        </div>

        <!-- File Upload Area -->
        <div
          class="border-2 border-dashed rounded-lg p-12 text-center transition-colors"
          :class="[
            isDragging
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          ]"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleFileDrop"
        >
          <UIcon
            name="i-heroicons-cloud-arrow-up"
            class="w-16 h-16 mx-auto mb-4 text-gray-400"
          />
          
          <div v-if="!uploadedFile" class="space-y-2">
            <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
              Drag & drop file Excel di sini
            </p>
            <p class="text-sm text-gray-500">atau</p>
            <UButton
              label="Pilih File"
              icon="i-heroicons-folder-open"
              @click="triggerFileInput"
            />
            <p class="text-xs text-gray-400 mt-2">
              Format: .xlsx, .xls (Max 10MB)
            </p>
          </div>

          <div v-else class="space-y-4">
            <UIcon
              name="i-heroicons-document-check"
              class="w-12 h-12 mx-auto text-green-500"
            />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ uploadedFile.name }}
              </p>
              <p class="text-sm text-gray-500">
                {{ formatFileSize(uploadedFile.size) }}
              </p>
            </div>
            <UButton
              label="Ganti File"
              variant="outline"
              size="sm"
              @click="clearFile"
            />
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="handleFileSelect"
        />

        <!-- Template Download -->
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-information-circle"
              class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Belum punya template?
              </p>
              <p class="text-sm text-blue-700 dark:text-blue-300 mb-2">
                Download template Excel untuk melihat format yang benar
              </p>
              <UButton
                label="Download Template"
                icon="i-heroicons-arrow-down-tray"
                size="sm"
                variant="outline"
                color="blue"
                @click="downloadTemplate"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-8 flex justify-end gap-3">
          <UButton
            label="Lanjut ke Preview"
            icon-trailing="i-heroicons-arrow-right"
            :disabled="!uploadedFile"
            :loading="isProcessing"
            @click="parseExcelFile"
          />
        </div>
      </div>

      <!-- Step 2: Preview Data -->
      <div v-if="currentStep === 2" class="p-6">
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Preview Data</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Periksa data yang akan diimport
          </p>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <UCard>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Properties</p>
                <p class="text-2xl font-bold">{{ previewData.propertiesCount }}</p>
              </div>
              <UIcon name="i-heroicons-building-office" class="w-8 h-8 text-blue-500" />
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Rooms</p>
                <p class="text-2xl font-bold">{{ previewData.roomsCount }}</p>
              </div>
              <UIcon name="i-heroicons-home" class="w-8 h-8 text-green-500" />
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Tenants</p>
                <p class="text-2xl font-bold">{{ previewData.tenantsCount }}</p>
              </div>
              <UIcon name="i-heroicons-user-group" class="w-8 h-8 text-purple-500" />
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Occupied</p>
                <p class="text-2xl font-bold">{{ previewData.occupiedCount }}</p>
              </div>
              <UIcon name="i-heroicons-check-circle" class="w-8 h-8 text-orange-500" />
            </div>
          </UCard>
        </div>

        <!-- Options Panel -->
        <UCard class="mb-6 bg-gray-50 dark:bg-gray-800">
          <div class="space-y-4">
            <h3 class="font-medium">Opsi Import</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                   Periode Data (Meter Reading)
                 </label>
                 <UInput type="month" v-model="importOptions.targetPeriod" />
                 <p class="text-xs text-gray-500 mt-1">Meter reading akan dicatat pada periode ini</p>
              </div>
              
              <div class="space-y-2">
                <UCheckbox
                  v-model="importOptions.updateExisting"
                  disabled 
                  label="Update data yang ada (UPSERT)"
                  help="Data yang ditemukan akan otomatis di-update"
                />
                <div class="flex gap-4">
                  <UCheckbox
                    v-model="importOptions.generateDefaultPassword"
                    label="Auto Password (Users)"
                  />
                  <UCheckbox
                    v-model="importOptions.generateDefaultPin"
                    label="Auto PIN (Tenants)"
                  />
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Tabs for different data views -->
        <UTabs :items="previewTabs" v-model="activePreviewTab" class="mb-6">
          <template #properties>
            <div class="overflow-x-auto">
              <UTable :rows="previewData.properties" :columns="propertyColumns">
                <template #rooms_count-data="{ row }">
                  <UBadge color="blue" variant="soft">
                    {{ row.rooms_count }} rooms
                  </UBadge>
                </template>
              </UTable>
            </div>
          </template>

          <template #rooms>
            <div class="overflow-x-auto">
              <UTable
                :rows="previewData.rooms.slice(0, 10)"
                :columns="roomColumns"
              >
                <template #status-data="{ row }">
                  <UBadge
                    :color="row.status === 'occupied' ? 'green' : 'gray'"
                    variant="soft"
                  >
                    {{ row.status }}
                  </UBadge>
                </template>
                <template #price-data="{ row }">
                  Rp {{ formatNumber(row.price) }}
                </template>
              </UTable>
              <p v-if="previewData.rooms.length > 10" class="text-sm text-gray-500 mt-2">
                Menampilkan 10 dari {{ previewData.rooms.length }} rooms
              </p>
            </div>
          </template>

          <template #tenants>
            <div class="overflow-x-auto">
              <UTable
                :rows="previewData.tenants.slice(0, 10)"
                :columns="tenantColumns"
              >
                <template #is_dummy-data="{ row }">
                  <UBadge
                    v-if="row.is_dummy"
                    color="orange"
                    variant="soft"
                  >
                    Dummy Data
                  </UBadge>
                </template>
              </UTable>
              <p v-if="previewData.tenants.length > 10" class="text-sm text-gray-500 mt-2">
                Menampilkan 10 dari {{ previewData.tenants.length }} tenants
              </p>
            </div>
          </template>
        </UTabs>

        <!-- Validation Warnings -->
        <UAlert
          v-if="validationWarnings.length > 0"
          icon="i-heroicons-exclamation-triangle"
          color="orange"
          variant="soft"
          title="Peringatan Validasi"
          class="mb-6"
        >
          <template #description>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li v-for="warning in validationWarnings" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </template>
        </UAlert>

        <!-- Actions -->
        <div class="flex justify-between gap-3">
          <UButton
            label="Kembali"
            icon="i-heroicons-arrow-left"
            variant="outline"
            @click="currentStep = 1"
          />
          <UButton
            label="Validasi & Lanjut"
            icon-trailing="i-heroicons-arrow-right"
            @click="validateData"
          />
        </div>
      </div>

      <!-- Step 3: Validation -->
      <div v-if="currentStep === 3" class="p-6">
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Validasi Data</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Hasil validasi data sebelum import
          </p>
        </div>

        <!-- Validation Results -->
        <div class="space-y-4 mb-6">
          <!-- Success Items -->
          <UCard v-if="validationResults.valid.length > 0">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-check-circle"
                class="w-6 h-6 text-green-500 mt-0.5"
              />
              <div class="flex-1">
                <h3 class="font-medium text-green-900 dark:text-green-100 mb-2">
                  Data Valid ({{ validationResults.valid.length }})
                </h3>
                <ul class="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li v-for="item in validationResults.valid" :key="item">
                    ✓ {{ item }}
                  </li>
                </ul>
              </div>
            </div>
          </UCard>

          <!-- Warning Items -->
          <UCard v-if="validationResults.warnings.length > 0">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-6 h-6 text-orange-500 mt-0.5"
              />
              <div class="flex-1">
                <h3 class="font-medium text-orange-900 dark:text-orange-100 mb-2">
                  Peringatan ({{ validationResults.warnings.length }})
                </h3>
                <ul class="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                  <li v-for="item in validationResults.warnings" :key="item">
                    ⚠ {{ item }}
                  </li>
                </ul>
              </div>
            </div>
          </UCard>

          <!-- Error Items -->
          <UCard v-if="validationResults.errors.length > 0">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-x-circle"
                class="w-6 h-6 text-red-500 mt-0.5"
              />
              <div class="flex-1">
                <h3 class="font-medium text-red-900 dark:text-red-100 mb-2">
                  Error ({{ validationResults.errors.length }})
                </h3>
                <ul class="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <li v-for="item in validationResults.errors" :key="item">
                    ✗ {{ item }}
                  </li>
                </ul>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Import Options -->
        <UCard class="mb-6 bg-gray-50 dark:bg-gray-900">
          <h3 class="font-medium mb-4">Opsi Import</h3>
          <div class="space-y-3">
            <UCheckbox
              v-model="importOptions.skipDuplicates"
              label="Skip data duplikat (berdasarkan nama)"
            />
            <UCheckbox
              v-model="importOptions.updateExisting"
              label="Update data yang sudah ada"
              :disabled="importOptions.skipDuplicates"
            />
            <UCheckbox
              v-model="importOptions.generateDefaultPassword"
              label="Generate password default untuk user baru"
            />
            <UCheckbox
              v-model="importOptions.generateDefaultPin"
              label="Generate PIN default untuk tenant baru"
            />
          </div>
        </UCard>

        <!-- Actions -->
        <div class="flex justify-between gap-3">
          <UButton
            label="Kembali"
            icon="i-heroicons-arrow-left"
            variant="outline"
            @click="currentStep = 2"
          />
          <UButton
            label="Mulai Import"
            icon="i-heroicons-arrow-down-tray"
            color="green"
            :disabled="validationResults.errors.length > 0"
            @click="startImport"
          />
        </div>
      </div>

      <!-- Step 4: Import Progress -->
      <div v-if="currentStep === 4" class="p-6">
        <div class="mb-6 text-center">
          <h2 class="text-xl font-semibold mb-2">Importing Data...</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Mohon tunggu, proses import sedang berjalan
          </p>
        </div>

        <!-- Progress Bar -->
        <div class="mb-8">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-gray-600 dark:text-gray-400">
              {{ importProgress.current }} / {{ importProgress.total }}
            </span>
            <span class="font-medium">{{ importProgress.percentage }}%</span>
          </div>
          <UProgress :value="importProgress.percentage" size="lg" />
        </div>

        <!-- Import Steps -->
        <div class="space-y-3 mb-6">
          <div
            v-for="step in importSteps"
            :key="step.key"
            class="flex items-center gap-3 p-3 rounded-lg"
            :class="[
              step.status === 'completed' ? 'bg-green-50 dark:bg-green-950' :
              step.status === 'processing' ? 'bg-blue-50 dark:bg-blue-950' :
              step.status === 'error' ? 'bg-red-50 dark:bg-red-950' :
              'bg-gray-50 dark:bg-gray-900'
            ]"
          >
            <UIcon
              v-if="step.status === 'completed'"
              name="i-heroicons-check-circle"
              class="w-6 h-6 text-green-500"
            />
            <UIcon
              v-else-if="step.status === 'processing'"
              name="i-heroicons-arrow-path"
              class="w-6 h-6 text-blue-500 animate-spin"
            />
            <UIcon
              v-else-if="step.status === 'error'"
              name="i-heroicons-x-circle"
              class="w-6 h-6 text-red-500"
            />
            <UIcon
              v-else
              name="i-heroicons-clock"
              class="w-6 h-6 text-gray-400"
            />
            
            <div class="flex-1">
              <p class="font-medium">{{ step.label }}</p>
              <p v-if="step.count" class="text-sm text-gray-600 dark:text-gray-400">
                {{ step.count }} items
              </p>
            </div>

            <UBadge
              v-if="step.status === 'completed'"
              color="green"
              variant="soft"
            >
              Selesai
            </UBadge>
            <UBadge
              v-else-if="step.status === 'processing'"
              color="blue"
              variant="soft"
            >
              Proses...
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Step 5: Result -->
      <div v-if="currentStep === 5" class="p-6">
        <div class="text-center mb-8">
          <UIcon
            :name="importResult.success ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
            :class="[
              'w-20 h-20 mx-auto mb-4',
              importResult.success ? 'text-green-500' : 'text-red-500'
            ]"
          />
          <h2 class="text-2xl font-bold mb-2">
            {{ importResult.success ? 'Import Berhasil!' : 'Import Gagal' }}
          </h2>
          <p class="text-gray-600 dark:text-gray-400">
            {{ importResult.message }}
          </p>
        </div>

        <!-- Result Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <UCard>
            <div class="text-center">
              <p class="text-3xl font-bold text-green-600">
                {{ importResult.stats.created }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Dibuat</p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-3xl font-bold text-blue-600">
                {{ importResult.stats.updated }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Diupdate</p>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-3xl font-bold text-orange-600">
                {{ importResult.stats.skipped }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Dilewati</p>
            </div>
          </UCard>
        </div>

        <!-- Detailed Results -->
        <UCard v-if="importResult.details" class="mb-6">
          <h3 class="font-medium mb-4">Detail Import</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Users:</span>
              <span class="font-medium">{{ importResult.details.users }} created</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Properties:</span>
              <span class="font-medium">{{ importResult.details.properties }} created</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Property Settings:</span>
              <span class="font-medium">{{ importResult.details.propertySettings }} created</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Tenants:</span>
              <span class="font-medium">{{ importResult.details.tenants }} created</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Rooms:</span>
              <span class="font-medium">{{ importResult.details.rooms }} created</span>
            </div>
          </div>
        </UCard>

        <!-- Errors (if any) -->
        <UAlert
          v-if="importResult.errors && importResult.errors.length > 0"
          icon="i-heroicons-exclamation-triangle"
          color="red"
          variant="soft"
          title="Error Details"
          class="mb-6"
        >
          <template #description>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li v-for="error in importResult.errors" :key="error">
                {{ error }}
              </li>
            </ul>
          </template>
        </UAlert>

        <!-- Actions -->
        <div class="flex justify-center gap-3">
          <UButton
            label="Import Lagi"
            icon="i-heroicons-arrow-path"
            variant="outline"
            @click="resetImport"
          />
          <UButton
            label="Lihat Data"
            icon="i-heroicons-table-cells"
            @click="navigateTo('/properties')"
          />
        </div>
      </div>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import * as XLSX from 'xlsx'

definePageMeta({
  layout: 'default'
  // middleware: 'auth' // TODO: Re-enable when auth middleware is ready
})

// State
const currentStep = ref(1)
const isDragging = ref(false)
const uploadedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()
const isProcessing = ref(false)
const activePreviewTab = ref(0)

// Steps
const steps = [
  { label: 'Upload', icon: 'i-heroicons-cloud-arrow-up' },
  { label: 'Preview', icon: 'i-heroicons-eye' },
  { label: 'Validasi', icon: 'i-heroicons-shield-check' },
  { label: 'Import', icon: 'i-heroicons-arrow-down-tray' },
  { label: 'Selesai', icon: 'i-heroicons-check-circle' }
]

// Preview Data
const previewData = ref({
  propertiesCount: 0,
  roomsCount: 0,
  tenantsCount: 0,
  occupiedCount: 0,
  properties: [] as any[],
  rooms: [] as any[],
  tenants: [] as any[],
  rawData: [] as any[]
})

// Preview Tabs
const previewTabs = [
  { key: 'properties', label: 'Properties', icon: 'i-heroicons-building-office' },
  { key: 'rooms', label: 'Rooms', icon: 'i-heroicons-home' },
  { key: 'tenants', label: 'Tenants', icon: 'i-heroicons-user-group' }
]

// Table Columns
const propertyColumns = [
  { key: 'name', label: 'Property Name' },
  { key: 'rooms_count', label: 'Rooms' },
  { key: 'cost_per_kwh', label: 'Cost/kWh' },
  { key: 'water_fee', label: 'Water Fee' },
  { key: 'trash_fee', label: 'Trash Fee' }
]

const roomColumns = [
  { key: 'property_name', label: 'Property' },
  { key: 'name', label: 'Room' },
  { key: 'price', label: 'Price' },
  { key: 'status', label: 'Status' }
]

const tenantColumns = [
  { key: 'name', label: 'Name' },
  { key: 'contact', label: 'Phone' },
  { key: 'id_card_number', label: 'NIK' },
  { key: 'is_dummy', label: 'Status' }
]

// Validation
const validationWarnings = ref<string[]>([])
const validationResults = ref({
  valid: [] as string[],
  warnings: [] as string[],
  errors: [] as string[]
})

// Import Options
const importOptions = ref({
  skipDuplicates: false,
  updateExisting: true,
  generateDefaultPassword: true,
  generateDefaultPin: true,
  targetPeriod: new Date().toISOString().slice(0, 7) // YYYY-MM
})

// Import Progress
const importProgress = ref({
  current: 0,
  total: 100,
  percentage: 0
})

const importSteps = ref([
  { key: 'users', label: 'Import Users', status: 'pending', count: 0 },
  { key: 'properties', label: 'Import Properties', status: 'pending', count: 0 },
  { key: 'settings', label: 'Import Property Settings', status: 'pending', count: 0 },
  { key: 'tenants', label: 'Import Tenants', status: 'pending', count: 0 },
  { key: 'rooms', label: 'Import Rooms', status: 'pending', count: 0 }
])

// Import Result
const importResult = ref({
  success: false,
  message: '',
  stats: {
    created: 0,
    updated: 0,
    skipped: 0
  },
  details: null as any,
  errors: [] as string[]
})

// Methods
const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (validateFile(file)) {
      uploadedFile.value = file
    }
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && validateFile(file)) {
    uploadedFile.value = file
  }
}

const validateFile = (file: File): boolean => {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
  
  if (!validTypes.includes(file.type)) {
    alert('File harus berformat .xlsx atau .xls')
    return false
  }
  
  if (file.size > 10 * 1024 * 1024) { // 10MB
    alert('Ukuran file maksimal 10MB')
    return false
  }
  
  return true
}

const clearFile = () => {
  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num)
}

const parseExcelFile = async () => {
  if (!uploadedFile.value) return
  
  isProcessing.value = true
  
  try {
    const arrayBuffer = await uploadedFile.value.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)
    
    // Store raw data
    previewData.value.rawData = data
    
    // Process data
    processPreviewData(data)
    
    // Move to preview step
    currentStep.value = 2
  } catch (error) {
    console.error('Error parsing Excel:', error)
    alert('Gagal membaca file Excel. Pastikan format file benar.')
  } finally {
    isProcessing.value = false
  }
}

const processPreviewData = (data: any[]) => {
  // Extract unique properties
  const propertiesMap = new Map()
  data.forEach((row: any) => {
    if (!propertiesMap.has(row.property_name)) {
      propertiesMap.set(row.property_name, {
        name: row.property_name,
        rooms_count: 0,
        cost_per_kwh: row.property_settings_cost_per_kwh,
        water_fee: row.water,
        trash_fee: row.trash
      })
    }
    propertiesMap.get(row.property_name).rooms_count++
  })
  
  previewData.value.properties = Array.from(propertiesMap.values())
  previewData.value.propertiesCount = propertiesMap.size
  
  // Extract rooms
  previewData.value.rooms = data.map((row: any) => ({
    property_name: row.property_name,
    name: row.rooms_name,
    price: row.rooms_price,
    status: row.room_status
  }))
  previewData.value.roomsCount = data.length
  previewData.value.occupiedCount = data.filter((r: any) => r.room_status === 'occupied').length
  
  // Extract unique tenants
  const tenantsMap = new Map()
  data.forEach((row: any) => {
    if (row.tenant_name) {
      const key = `${row.tenant_name}-${row.tenant_phone}`
      if (!tenantsMap.has(key)) {
        tenantsMap.set(key, {
          name: row.tenant_name,
          contact: row.tenant_phone,
          id_card_number: row.tenant_id_card_number,
          is_dummy: row.tenant_id_card_number === '0000000000000000'
        })
      }
    }
  })
  
  previewData.value.tenants = Array.from(tenantsMap.values())
  previewData.value.tenantsCount = tenantsMap.size
  
  // Generate warnings
  validationWarnings.value = []
  
  const dummyNIK = previewData.value.tenants.filter(t => t.is_dummy).length
  if (dummyNIK > 0) {
    validationWarnings.value.push(`${dummyNIK} tenants memiliki NIK dummy`)
  }
  
  const zeroPriceRooms = previewData.value.rooms.filter(r => r.price === 0).length
  if (zeroPriceRooms > 0) {
    validationWarnings.value.push(`${zeroPriceRooms} rooms memiliki harga 0`)
  }
}

const validateData = () => {
  validationResults.value = {
    valid: [],
    warnings: [],
    errors: []
  }
  
  // Validation checks
  validationResults.value.valid.push(`${previewData.value.propertiesCount} properties siap diimport`)
  validationResults.value.valid.push(`${previewData.value.roomsCount} rooms siap diimport`)
  validationResults.value.valid.push(`${previewData.value.tenantsCount} tenants siap diimport`)
  
  // Check for warnings
  const dummyData = previewData.value.tenants.filter(t => t.is_dummy).length
  if (dummyData > 0) {
    validationResults.value.warnings.push(`${dummyData} tenants menggunakan data dummy (NIK/Phone)`)
  }
  
  const zeroPrice = previewData.value.rooms.filter(r => r.price === 0).length
  if (zeroPrice > 0) {
    validationResults.value.warnings.push(`${zeroPrice} rooms memiliki harga 0`)
  }
  
  // Check for errors
  const invalidRooms = previewData.value.rooms.filter(r => !r.name || !r.property_name)
  if (invalidRooms.length > 0) {
    validationResults.value.errors.push(`${invalidRooms.length} rooms memiliki data tidak lengkap`)
  }
  
  currentStep.value = 3
}

const startImport = async () => {
  currentStep.value = 4
  
  try {
    // Simulate import process with progress
    const steps = importSteps.value
    const totalSteps = steps.length
    
    for (let i = 0; i < steps.length; i++) {
      steps[i].status = 'processing'
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      steps[i].status = 'completed'
      importProgress.value.current = i + 1
      importProgress.value.total = totalSteps
      importProgress.value.percentage = Math.round(((i + 1) / totalSteps) * 100)
    }
    
    // Call actual import API
    const { data, error } = await useFetch('/api/import/excel', {
      method: 'POST',
      body: {
        data: previewData.value.rawData,
        options: importOptions.value
      }
    })
    
    if (error.value) {
      throw new Error(error.value.message)
    }
    
    importResult.value = {
      success: true,
      message: 'Data berhasil diimport ke database',
      stats: data.value?.stats || { created: 0, updated: 0, skipped: 0 },
      details: data.value?.details || null,
      errors: []
    }
  } catch (error: any) {
    importResult.value = {
      success: false,
      message: 'Terjadi kesalahan saat import data',
      stats: { created: 0, updated: 0, skipped: 0 },
      details: null,
      errors: [error.message]
    }
  } finally {
    currentStep.value = 5
  }
}

const resetImport = () => {
  currentStep.value = 1
  uploadedFile.value = null
  previewData.value = {
    propertiesCount: 0,
    roomsCount: 0,
    tenantsCount: 0,
    occupiedCount: 0,
    properties: [],
    rooms: [],
    tenants: [],
    rawData: []
  }
  validationWarnings.value = []
  validationResults.value = { valid: [], warnings: [], errors: [] }
  importProgress.value = { current: 0, total: 100, percentage: 0 }
  importSteps.value.forEach(step => { step.status = 'pending' })
}

const downloadTemplate = () => {
  // Create template data
  const templateData = [
    {
      users_email: 'owner@example.com',
      property_name: 'PONDOK EXAMPLE',
      property_address: 'Jalan Example No. 123',
      property_description: 'Kost Example',
      rooms_name: 'ROOM-01',
      rooms_price: 1000000,
      property_settings_cost_per_kwh: 2200,
      water: 15000,
      trash: 25000,
      room_status: 'available',
      use_trash_service: true,
      move_in_date: 20260101,
      ocupant_count: 1,
      tenant_name: '',
      tenant_id_card_number: '',
      tenant_phone: '',
      meter_start: 0,
      meter_end: 0,
      recorder_by: 'owner@example.com'
    }
  ]
  
  const ws = XLSX.utils.json_to_sheet(templateData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, 'template_import_kostman.xlsx')
}
</script>

<style scoped>
/* Add any custom styles if needed */
</style>
