import { getBackupHistory } from '../../utils/backup'
import { requireRole, Role } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER])
  
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 10
  
  const history = await getBackupHistory(limit)
  
  return {
    backups: history,
    total: history.length,
  }
})
