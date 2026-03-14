import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { getBackupById, BACKUP_DIR } from '../../../utils/backup'
import { requireRole, Role } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER])

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing backup ID' })

  const backup = await getBackupById(id)
  if (!backup) throw createError({ statusCode: 404, message: 'Backup tidak ditemukan' })
  if (!backup.storagePath) throw createError({ statusCode: 404, message: 'File backup tidak tersedia' })
  if (!existsSync(backup.storagePath)) throw createError({ statusCode: 404, message: 'File backup tidak ada di server' })

  // Security: ensure storagePath is within the allowed backup directory
  const realPath = path.resolve(backup.storagePath)
  const realBackupDir = path.resolve(BACKUP_DIR)
  if (!realPath.startsWith(realBackupDir + path.sep) && realPath !== realBackupDir) {
    throw createError({ statusCode: 403, message: 'Akses ditolak' })
  }

  setResponseHeader(event, 'Content-Type', 'application/octet-stream')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${backup.filename}"`)

  return sendStream(event, createReadStream(backup.storagePath))
})
