import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { whatsappTemplates } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const templates = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.userId, user.id))

  return {
    templates
  }
})
