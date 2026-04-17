import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { properties, whatsappTemplates } from '../../database/schema'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP } from '../../../shared/whatsapp-template-defaults'

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  message: z.string().min(1),
  templateType: z.enum(['billing', 'reminder_overdue', 'reminder_due_soon', 'general']).optional(),
  isDefault: z.boolean().optional(),
  propertyIds: z.array(z.string().uuid()).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const body = await readBody(event)
  const data = templateSchema.parse(body)
  const templateType = data.templateType || 'general'
  const propertyIds = data.propertyIds || []

  if (propertyIds.length > 0) {
    const matchedProperties = await (user.role === Role.OWNER
      ? db.select({ id: properties.id })
          .from(properties)
          .where(and(eq(properties.userId, user.id), inArray(properties.id, propertyIds)))
      : db.select({ id: properties.id })
          .from(properties)
          .where(inArray(properties.id, propertyIds)))

    if (matchedProperties.length !== propertyIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'One or more selected properties are invalid',
      })
    }
  }

  // If setting as default, unset other defaults for the same template type
  if (data.isDefault) {
    await db.update(whatsappTemplates)
      .set({ isDefault: false })
      .where(and(
        eq(whatsappTemplates.userId, user.id),
        eq(whatsappTemplates.templateType, templateType),
      ))
  }

  const template = await db.transaction(async (tx) => {
    const [createdTemplate] = await tx.insert(whatsappTemplates).values({
      userId: user.id,
      name: data.name,
      message: data.message,
      templateType,
      isDefault: data.isDefault || false,
    }).returning()

    if (propertyIds.length > 0) {
      const propertyField = PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP[templateType]

      await tx.update(properties)
        .set({ [propertyField]: createdTemplate.id })
        .where(inArray(properties.id, propertyIds))
    }

    return createdTemplate
  })

  return {
    message: 'Template berhasil disimpan',
    template
  }
})
