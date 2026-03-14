import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { backups } from '../../database/schema'
import { asc } from 'drizzle-orm'
import { existsSync, unlinkSync } from 'node:fs'
import { MAX_BACKUPS } from '../../utils/backup'

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER])

  const all = await db.select().from(backups).orderBy(asc(backups.createdAt))

  if (all.length <= MAX_BACKUPS) {
    return { success: true, deletedCount: 0, message: 'Tidak ada backup yang perlu dihapus' }
  }

  const toDelete = all.slice(0, all.length - MAX_BACKUPS)
  for (const b of toDelete) {
    if (b.storagePath && existsSync(b.storagePath)) {
      try { unlinkSync(b.storagePath) } catch { /* ignore */ }
    }
    await db.delete(backups).where(eq(backups.id, b.id))
  }

  return {
    success: true,
    deletedCount: toDelete.length,
    message: `${toDelete.length} backup lama berhasil dihapus`,
  }
})
