import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { whatsappTemplates } from '../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const id = getRouterParam(event, 'id')

  const [deleted] = await db.delete(whatsappTemplates)
    .where(and(
      eq(whatsappTemplates.id, id!),
      eq(whatsappTemplates.userId, user.id)
    ))
    .returning()

  if (!deleted) {
    throw createError({
      statusCode: 404,
      message: 'Template tidak ditemukan'
    })
  }

  return {
    message: 'Template berhasil dihapus'
  }
})
