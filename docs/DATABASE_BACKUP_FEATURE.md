# Database Backup Feature - KostMan

## Overview
Implementasi fitur backup database untuk mengamankan data aplikasi KostMan secara periodik maupun manual.

---

## 🎯 Features

### Core Features
- ✅ Manual backup via settings page
- ✅ Download backup sebagai file SQL (gzip compressed)
- ✅ Upload backup ke MinIO storage (optional)
- ✅ Backup history tracking
- ✅ Auto cleanup old backups
- ✅ Scheduled automatic backups
- ✅ Restore from backup
- ✅ Selective table backup

---

## 🏗️ Architecture

```
User clicks "Backup Now"
         ↓
API: /api/backup/database
         ↓
pg_dump → SQL file
         ↓
Compress (gzip)
         ↓
   ┌────────┴────────┐
   ↓                 ↓
Download to      Upload to
Browser          MinIO
   ↓                 ↓
User saves       Cloud Storage
locally          (persistent)
```

---

## 💾 Database Schema

### Backup History Table

```typescript
// server/database/schema.ts

export const backups = pgTable('backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename', { length: 255 }).notNull(),
  size: integer('size').notNull(), // bytes
  type: varchar('type', { length: 50 }).notNull(), // 'manual', 'scheduled'
  storagePath: varchar('storage_path', { length: 512 }), // MinIO path
  metadata: json('metadata').$type<{
    tables: string[]
    recordCount: number
    duration: number // ms
  }>(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Backup = typeof backups.$inferSelect
export type NewBackup = typeof backups.$inferInsert
```

### Migration

```typescript
// server/database/migrations/0010_add_backups.sql

CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  size INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  storage_path VARCHAR(512),
  metadata JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_backups_type ON backups(type);
```

---

## 🔧 Implementation

### 1. Backup Utility

```typescript
// server/utils/backup.ts

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { minioClient } from './minio'

const execAsync = promisify(exec)

interface BackupOptions {
  type: 'manual' | 'scheduled'
  tables?: string[]
  uploadToMinio?: boolean
}

export async function createDatabaseBackup(options: BackupOptions = { type: 'manual' }) {
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const filename = `kostman-backup-${timestamp}-${Date.now()}.sql.gz`
  const tempPath = path.join('/tmp', filename)
  
  try {
    // Get database URL from env
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) throw new Error('DATABASE_URL not configured')
    
    // Build pg_dump command
    let command = `pg_dump "${dbUrl}"`
    
    // Selective backup if tables specified
    if (options.tables && options.tables.length > 0) {
      const tableFlags = options.tables.map(t => `-t ${t}`).join(' ')
      command += ` ${tableFlags}`
    }
    
    // Add compression
    command += ` | gzip > ${tempPath}`
    
    // Execute backup
    await execAsync(command)
    
    // Get file stats
    const stats = await fs.stat(tempPath)
    const buffer = await fs.readFile(tempPath)
    
    let storagePath: string | undefined
    
    // Upload to MinIO if requested
    if (options.uploadToMinio) {
      const bucketName = 'kostman-backups'
      await ensureBackupBucketExists()
      
      storagePath = `backups/${new Date().getFullYear()}/${filename}`
      await minioClient.putObject(bucketName, storagePath, buffer, buffer.length, {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
    }
    
    // Cleanup temp file
    await fs.unlink(tempPath)
    
    return {
      filename,
      buffer,
      size: stats.size,
      storagePath,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    // Cleanup on error
    try {
      await fs.unlink(tempPath)
    } catch {}
    
    throw error
  }
}

async function ensureBackupBucketExists() {
  const bucketName = 'kostman-backups'
  const exists = await minioClient.bucketExists(bucketName)
  
  if (!exists) {
    await minioClient.makeBucket(bucketName, 'us-east-1')
    
    // Set lifecycle policy - delete after 30 days
    const lifecycleConfig = {
      Rule: [{
        ID: 'delete-old-backups',
        Status: 'Enabled',
        Expiration: { Days: 30 },
      }],
    }
    await minioClient.setBucketLifecycle(bucketName, lifecycleConfig)
  }
}

export async function getBackupHistory(limit = 10) {
  return await db.select()
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(limit)
}

export async function cleanupOldBackups(daysToKeep = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  const oldBackups = await db.select()
    .from(backups)
    .where(lte(backups.createdAt, cutoffDate))
  
  for (const backup of oldBackups) {
    // Delete from MinIO if exists
    if (backup.storagePath) {
      try {
        await minioClient.removeObject('kostman-backups', backup.storagePath)
      } catch (err) {
        console.error(`Failed to delete backup from MinIO: ${backup.storagePath}`, err)
      }
    }
    
    // Delete from database
    await db.delete(backups).where(eq(backups.id, backup.id))
  }
  
  return oldBackups.length
}
```

### 2. Backup API Endpoint

```typescript
// server/api/backup/database.post.ts

import { createDatabaseBackup, getBackupHistory } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  // Check authentication
  const user = await requireAuth(event)
  
  // Check admin role
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Only administrators can create backups',
    })
  }
  
  const body = await readBody(event).catch(() => ({}))
  const uploadToMinio = body.uploadToMinio ?? true
  
  try {
    // Create backup
    const result = await createDatabaseBackup({
      type: 'manual',
      uploadToMinio,
    })
    
    // Save to database
    const [backupRecord] = await db.insert(backups).values({
      filename: result.filename,
      size: result.size,
      type: 'manual',
      storagePath: result.storagePath,
      metadata: {
        tables: [],
        recordCount: 0,
        duration: result.duration,
      },
      createdBy: user.id,
    }).returning()
    
    // Return file as download
    setResponseHeader(event, 'Content-Type', 'application/gzip')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${result.filename}"`)
    
    return result.buffer
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to create backup',
    })
  }
})
```

### 3. Backup History API

```typescript
// server/api/backup/history.get.ts

import { getBackupHistory } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 10
  
  const history = await getBackupHistory(limit)
  
  return {
    backups: history,
    total: history.length,
  }
})
```

### 4. Download from MinIO API

```typescript
// server/api/backup/download/[id].get.ts

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  
  const backupId = getRouterParam(event, 'id')
  
  const [backup] = await db.select()
    .from(backups)
    .where(eq(backups.id, backupId))
  
  if (!backup || !backup.storagePath) {
    throw createError({ statusCode: 404, message: 'Backup not found' })
  }
  
  try {
    // Generate presigned URL (valid for 1 hour)
    const url = await minioClient.presignedGetObject(
      'kostman-backups',
      backup.storagePath,
      60 * 60
    )
    
    return { url }
  } catch (error) {
    throw createError({ statusCode: 500, message: 'Failed to generate download URL' })
  }
})
```

### 5. Cleanup API

```typescript
// server/api/backup/cleanup.post.ts

import { cleanupOldBackups } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin only' })
  }
  
  const body = await readBody(event)
  const daysToKeep = body.daysToKeep || 30
  
  const deletedCount = await cleanupOldBackups(daysToKeep)
  
  return {
    success: true,
    deletedCount,
    message: `Deleted ${deletedCount} old backup(s)`,
  }
})
```

---

## 🎨 Frontend Implementation

### Settings Page - Backup Section

```vue
<!-- app/pages/settings/index.vue -->

<script setup lang="ts">
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
    const url = window.URL.createObjectURL(response)
    const a = document.createElement('a')
    a.href = url
    a.download = `kostman-backup-${new Date().toISOString().split('T')[0]}.sql.gz`
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
      description: error.message || 'Gagal membuat backup',
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

async function downloadBackup(backupId: string) {
  try {
    const { url } = await $fetch(`/api/backup/download/${backupId}`)
    window.open(url, '_blank')
  } catch (error: any) {
    toast.add({
      title: 'Gagal',
      description: 'Gagal mengunduh backup',
      color: 'error',
    })
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

onMounted(() => {
  loadBackupHistory()
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-cloud-arrow-down" class="w-5 h-5 text-primary-500" />
          <h3 class="font-semibold">Backup Database</h3>
        </div>
        <UButton 
          v-if="backupHistory.length > 0"
          variant="ghost" 
          size="sm"
          @click="showHistory = !showHistory"
        >
          {{ showHistory ? 'Sembunyikan' : 'Lihat' }} Riwayat
        </UButton>
      </div>
    </template>
    
    <div class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Backup seluruh data aplikasi termasuk properti, kamar, penghuni, tagihan, dan pembayaran.
        File backup akan diunduh dalam format SQL terkompresi (.sql.gz).
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
          color="warning"
          icon="i-heroicons-trash"
          @click="cleanupOldBackups"
        >
          Bersihkan Backup Lama
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
                </div>
              </div>
              
              <UButton 
                v-if="backup.storagePath"
                size="sm" 
                variant="ghost"
                icon="i-heroicons-arrow-down-tray"
                @click="downloadBackup(backup.id)"
              >
                Download
              </UButton>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div class="flex gap-2">
          <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div class="text-sm text-blue-700 dark:text-blue-300">
            <strong>Tips:</strong> Simpan backup secara berkala di tempat yang aman. 
            Backup otomatis dapat diaktifkan melalui scheduled tasks.
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
```

---

## 🤖 Scheduled Automatic Backups

### Using node-cron

```typescript
// server/plugins/scheduled-backup.ts

import cron from 'node-cron'
import { createDatabaseBackup, cleanupOldBackups } from '../utils/backup'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return
  
  // Daily backup at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduled Backup] Starting daily backup...')
    
    try {
      const result = await createDatabaseBackup({
        type: 'scheduled',
        uploadToMinio: true,
      })
      
      // Save to database
      await db.insert(backups).values({
        filename: result.filename,
        size: result.size,
        type: 'scheduled',
        storagePath: result.storagePath,
        metadata: {
          tables: [],
          recordCount: 0,
          duration: result.duration,
        },
      })
      
      console.log(`[Scheduled Backup] Success: ${result.filename} (${result.size} bytes)`)
    } catch (error) {
      console.error('[Scheduled Backup] Failed:', error)
    }
  })
  
  // Weekly cleanup - every Sunday at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Cleanup] Starting cleanup of old backups...')
    
    try {
      const deletedCount = await cleanupOldBackups(30)
      console.log(`[Cleanup] Deleted ${deletedCount} old backup(s)`)
    } catch (error) {
      console.error('[Cleanup] Failed:', error)
    }
  })
})
```

---

## 🔐 Security & Best Practices

### 1. **Authentication & Authorization**
- ✅ Only admin users can create backups
- ✅ Rate limiting: max 3 backups per hour
- ✅ Audit logging for backup operations

### 2. **Data Protection**
- ✅ Encrypt backups (optional with AES-256)
- ✅ Use presigned URLs for downloads (expire after 1 hour)
- ✅ Store backups in private MinIO bucket

### 3. **Storage Management**
- ✅ Auto cleanup old backups (>30 days)
- ✅ Lifecycle policies on MinIO
- ✅ Maximum backup size limit (e.g., 500MB)

### 4. **Error Handling**
- ✅ Graceful failure handling
- ✅ Cleanup temp files on error
- ✅ User-friendly error messages

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.11"
  }
}
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Backup creates valid SQL file
- [ ] Downloaded file can be extracted with gunzip
- [ ] Backup uploads to MinIO successfully
- [ ] Backup history displays correctly
- [ ] Download from MinIO works
- [ ] Cleanup removes old backups
- [ ] Scheduled backup runs at correct time
- [ ] Non-admin users cannot access backup endpoints
- [ ] Rate limiting prevents abuse

### Restore Test

```bash
# Extract backup
gunzip kostman-backup-2026-01-20.sql.gz

# Restore to database
psql $DATABASE_URL < kostman-backup-2026-01-20.sql

# Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM properties;"
```

---

## 📊 Monitoring & Alerts

### Metrics to Track
- Backup success/failure rate
- Backup file size trends
- Backup duration
- Storage usage in MinIO

### Alerts
- Failed scheduled backups
- Backup size exceeds threshold
- Storage quota nearly full

---

## 🚀 Future Enhancements

### Phase 2
- [ ] Incremental backups (only changes)
- [ ] Point-in-time recovery
- [ ] Multi-region backup replication
- [ ] Email notification on backup completion
- [ ] Backup encryption with user-provided key

### Phase 3
- [ ] Restore preview (dry-run)
- [ ] Selective restore (specific tables)
- [ ] Backup comparison tool
- [ ] Automated backup testing

---

## 📚 References

- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [MinIO Lifecycle Management](https://min.io/docs/minio/linux/administration/object-management/lifecycle-management.html)
- [Node-cron Scheduling](https://github.com/node-cron/node-cron)

---

**Status:** 📋 Ready for Implementation  
**Priority:** High (Production Critical)  
**Estimated Effort:** 2-3 days  
**Dependencies:** MinIO setup, Admin authentication  
**Updated:** January 20, 2026
