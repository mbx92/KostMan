import { cleanupOldBackups } from '../../utils/backup'
import { requireRole, Role } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER])
  
  const body = await readBody(event).catch(() => ({}))
  const daysToKeep = body.daysToKeep || 30
  
  const deletedCount = await cleanupOldBackups(daysToKeep)
  
  return {
    success: true,
    deletedCount,
    message: `Deleted ${deletedCount} old backup(s)`,
  }
})
