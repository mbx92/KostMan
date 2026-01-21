import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { whatsappTemplates } from '../../database/schema'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  message: z.string().min(1),
  templateType: z.enum(['billing', 'reminder_overdue', 'reminder_due_soon', 'general']).optional(),
  isDefault: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const body = await readBody(event)
  const data = templateSchema.parse(body)

  // If setting as default, unset other defaults for the same template type
  if (data.isDefault) {
    await db.update(whatsappTemplates)
      .set({ isDefault: false })
      .where(eq(whatsappTemplates.userId, user.id))
  }

  const [template] = await db.insert(whatsappTemplates).values({
    userId: user.id,
    name: data.name,
    message: data.message,
    templateType: data.templateType || 'general',
    isDefault: data.isDefault || false,
  }).returning()

  return {
    message: 'Template berhasil disimpan',
    template
  }
})
