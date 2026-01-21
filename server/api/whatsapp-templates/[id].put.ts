import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { whatsappTemplates } from '../../database/schema'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

const templateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  message: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const id = getRouterParam(event, 'id')

  const body = await readBody(event)
  const data = templateSchema.parse(body)

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await db.update(whatsappTemplates)
      .set({ isDefault: false })
      .where(eq(whatsappTemplates.userId, user.id))
  }

  const [template] = await db.update(whatsappTemplates)
    .set(data)
    .where(and(
      eq(whatsappTemplates.id, id!),
      eq(whatsappTemplates.userId, user.id)
    ))
    .returning()

  if (!template) {
    throw createError({
      statusCode: 404,
      message: 'Template tidak ditemukan'
    })
  }

  return {
    message: 'Template berhasil diperbarui',
    template
  }
})
