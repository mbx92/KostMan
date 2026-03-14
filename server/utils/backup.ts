import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { db } from './drizzle'
import { backups } from '../database/schema'
import { desc, eq, asc } from 'drizzle-orm'

const execFileAsync = promisify(execFile)

export const MAX_BACKUPS = 5
export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

export async function createDatabaseBackup(options: { type: 'manual' | 'scheduled'; userId?: string }) {
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
  const filename = `kostman-backup-${timestamp}.sql`

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL not configured')

  // Parse connection URL safely (avoids shell injection from special chars in password)
  const url = new URL(dbUrl)
  const host = url.hostname
  const port = url.port || '5432'
  const username = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = url.pathname.replace(/^\//, '')
  const sslMode = url.searchParams.get('sslmode')

  const pgEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PGPASSWORD: password,
  }
  if (sslMode) pgEnv.PGSSLMODE = sslMode

  // Use execFile (no shell) to safely pass args without interpolation
  const { stdout } = await execFileAsync(
    'pg_dump',
    ['-h', host, '-p', port, '-U', username, database],
    { env: pgEnv, maxBuffer: 500 * 1024 * 1024 }
  )

  // Save to disk
  ensureBackupDir()
  const filePath = path.join(BACKUP_DIR, filename)
  await fs.writeFile(filePath, stdout, 'utf-8')

  const size = Buffer.byteLength(stdout, 'utf-8')

  // Save record to DB
  const [record] = await db.insert(backups).values({
    filename,
    size,
    type: options.type,
    storagePath: filePath,
    duration: Date.now() - startTime,
    createdBy: options.userId ?? null,
  }).returning()

  // Enforce max 5 backups – delete oldest
  await pruneBackups()

  return record
}

async function pruneBackups() {
  const all = await db.select()
    .from(backups)
    .orderBy(asc(backups.createdAt))

  if (all.length > MAX_BACKUPS) {
    const toDelete = all.slice(0, all.length - MAX_BACKUPS)
    for (const b of toDelete) {
      if (b.storagePath) {
        try { await fs.unlink(b.storagePath) } catch { /* file already gone */ }
      }
      await db.delete(backups).where(eq(backups.id, b.id))
    }
  }
}

export async function getBackupHistory(limit = MAX_BACKUPS) {
  return db.select()
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
