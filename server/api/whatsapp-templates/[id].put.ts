import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { properties, whatsappTemplates } from '../../database/schema'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP } from '../../../shared/whatsapp-template-defaults'

const templateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  message: z.string().min(1).optional(),
  templateType: z.enum(['billing', 'reminder_overdue', 'reminder_due_soon', 'general']).optional(),
  isDefault: z.boolean().optional(),
  propertyIds: z.array(z.string().uuid()).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const id = getRouterParam(event, 'id')

  const body = await readBody(event)
  const data = templateSchema.parse(body)
  const propertyIds = data.propertyIds || []

  const [existingTemplate] = await db.select()
    .from(whatsappTemplates)
    .where(and(
      eq(whatsappTemplates.id, id!),
      eq(whatsappTemplates.userId, user.id)
    ))
    .limit(1)

  if (!existingTemplate) {
    throw createError({
      statusCode: 404,
      message: 'Template tidak ditemukan'
    })
  }

  const nextTemplateType = data.templateType || existingTemplate.templateType

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

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await db.update(whatsappTemplates)
      .set({ isDefault: false })
      .where(and(
        eq(whatsappTemplates.userId, user.id),
        eq(whatsappTemplates.templateType, nextTemplateType),
      ))
  }

  const template = await db.transaction(async (tx) => {
    const previousField = PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP[existingTemplate.templateType]
    const nextField = PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP[nextTemplateType]

    await tx.update(properties)
      .set({ [previousField]: null })
      .where(eq(properties[previousField], existingTemplate.id))

    const [updatedTemplate] = await tx.update(whatsappTemplates)
      .set({
        name: data.name,
        message: data.message,
        templateType: data.templateType,
        isDefault: data.isDefault,
      })
      .where(and(
        eq(whatsappTemplates.id, id!),
        eq(whatsappTemplates.userId, user.id)
      ))
      .returning()

    if (propertyIds.length > 0) {
      await tx.update(properties)
        .set({ [nextField]: updatedTemplate.id })
        .where(inArray(properties.id, propertyIds))
    }

    return updatedTemplate
  })

  return {
    message: 'Template berhasil diperbarui',
    template
  }
})
