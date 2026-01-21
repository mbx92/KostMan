import { createDatabaseBackup } from '../../utils/backup'
import { db } from '../../utils/drizzle'
import { backups } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Check authentication
  const user = requireRole(event, [Role.ADMIN, Role.OWNER])
  
  try {
    // Create backup
    const result = await createDatabaseBackup({
      type: 'manual',
    })
    
    // Save to database
    const [backupRecord] = await db.insert(backups).values({
      filename: result.filename,
      size: result.size,
      type: 'manual',
      duration: result.duration,
      createdBy: user.id,
    }).returning()
    
    // Set response headers for file download
    setResponseHeader(event, 'Content-Type', 'application/sql')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${result.filename}"`)
    setResponseHeader(event, 'Content-Length', result.size.toString())
    
    return result.buffer
  } catch (error: any) {
    console.error('Backup creation failed:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to create backup',
    })
  }
})
