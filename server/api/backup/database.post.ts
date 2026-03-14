import { createDatabaseBackup } from '../../utils/backup'
import { requireRole, Role } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER])

  try {
    const record = await createDatabaseBackup({
      type: 'manual',
      userId: user.id,
    })

    return { success: true, backup: record }
  } catch (error: any) {
    console.error('Backup creation failed:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to create backup',
    })
  }
})
