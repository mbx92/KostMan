import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from './drizzle'
import { backups } from '../database/schema'
import { desc, lte, eq } from 'drizzle-orm'

const execAsync = promisify(exec)

interface BackupOptions {
  type: 'manual' | 'scheduled'
  tables?: string[]
}

export async function createDatabaseBackup(options: BackupOptions = { type: 'manual' }) {
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
  const filename = `kostman-backup-${timestamp}.sql`
  
  try {
    // Get database URL from env
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured')
    }
    
    // Build pg_dump command
    let command = `pg_dump "${dbUrl}"`
    
    // Selective backup if tables specified
    if (options.tables && options.tables.length > 0) {
      const tableFlags = options.tables.map(t => `-t ${t}`).join(' ')
      command += ` ${tableFlags}`
    }
    
    // Execute backup and get SQL as string
    const { stdout, stderr } = await execAsync(command)
    
    if (stderr && !stderr.includes('WARNING')) {
      console.error('Backup stderr:', stderr)
    }
    
    // Convert to buffer
    const buffer = Buffer.from(stdout, 'utf-8')
    
    return {
      filename,
      buffer,
      size: buffer.length,
      duration: Date.now() - startTime,
    }
  } catch (error: any) {
    console.error('Backup error:', error)
    throw new Error(`Failed to create backup: ${error.message}`)
  }
}

export async function getBackupHistory(limit = 10) {
  return await db.select()
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(limit)
}

export async function getBackupById(id: string) {
  const [backup] = await db.select()
    .from(backups)
    .where(eq(backups.id, id))
    .limit(1)
  
  return backup
}

export async function cleanupOldBackups(daysToKeep = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  const oldBackups = await db.select()
    .from(backups)
    .where(lte(backups.createdAt, cutoffDate))
  
  // Delete from database
  for (const backup of oldBackups) {
    await db.delete(backups).where(eq(backups.id, backup.id))
  }
  
  return oldBackups.length
}
