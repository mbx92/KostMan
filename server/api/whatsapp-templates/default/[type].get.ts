import { requireRole, Role } from '../../../utils/permissions'
import { db } from '../../../utils/drizzle'
import { properties, whatsappTemplates } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'
import {
  getDefaultWhatsAppTemplate,
  PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP,
} from '../../../../shared/whatsapp-template-defaults'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const templateType = getRouterParam(event, 'type') as 'billing' | 'reminder_overdue' | 'reminder_due_soon' | 'general'
  const query = getQuery(event)
  const propertyId = typeof query.propertyId === 'string' ? query.propertyId : undefined

  if (!templateType) {
    throw createError({
      statusCode: 400,
      message: 'Template type is required'
    })
  }

  let mappedTemplateId: string | null | undefined

  if (propertyId) {
    const [property] = await db.select({
      id: properties.id,
      userId: properties.userId,
      billingWhatsappTemplateId: properties.billingWhatsappTemplateId,
      reminderOverdueWhatsappTemplateId: properties.reminderOverdueWhatsappTemplateId,
      reminderDueSoonWhatsappTemplateId: properties.reminderDueSoonWhatsappTemplateId,
      generalWhatsappTemplateId: properties.generalWhatsappTemplateId,
    }).from(properties).where(eq(properties.id, propertyId)).limit(1)

    if (!property) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Property not found'
      })
    }

    if (user.role === Role.OWNER && property.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    mappedTemplateId = property[PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP[templateType]]
  }

  if (mappedTemplateId) {
    const [mappedTemplate] = await db.select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, mappedTemplateId))
      .limit(1)

    if (mappedTemplate) {
      return {
        template: {
          ...mappedTemplate,
          isBuiltIn: false
        }
      }
    }
  }

  // Try to find default template for this type
  let [template] = await db.select()
    .from(whatsappTemplates)
    .where(and(
      eq(whatsappTemplates.userId, user.id),
      eq(whatsappTemplates.templateType, templateType),
      eq(whatsappTemplates.isDefault, true)
    ))
    .limit(1)

  // If no default, get first template of this type
  if (!template) {
    [template] = await db.select()
      .from(whatsappTemplates)
      .where(and(
        eq(whatsappTemplates.userId, user.id),
        eq(whatsappTemplates.templateType, templateType)
      ))
      .limit(1)
  }

  // If still no template, return default built-in template
  if (!template) {
    const defaultTemplate = getDefaultWhatsAppTemplate(templateType)

    return {
      template: {
        id: null,
        name: defaultTemplate?.name || 'Template Default',
        message: defaultTemplate?.message || '{detail_tagihan}\n\n{link_pembayaran}',
        templateType,
        isDefault: true,
        isBuiltIn: true
      }
    }
  }

  return {
    template: {
      ...template,
      isBuiltIn: false
    }
  }
})
