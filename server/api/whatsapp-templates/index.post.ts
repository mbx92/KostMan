import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { whatsappTemplates } from '../../database/schema'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  message: z.string().min(1),
  isDefault: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const body = await readBody(event)
  const data = templateSchema.parse(body)

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await db.update(whatsappTemplates)
      .set({ isDefault: false })
      .where(eq(whatsappTemplates.userId, user.id))
  }

  const [template] = await db.insert(whatsappTemplates).values({
    userId: user.id,
    name: data.name,
    message: data.message,
    isDefault: data.isDefault || false,
  }).returning()

  return {
    message: 'Template berhasil disimpan',
    template
  }
})
