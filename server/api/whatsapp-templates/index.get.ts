import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { properties, whatsappTemplates } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP } from '../../../shared/whatsapp-template-defaults'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const query = getQuery(event)
  const propertyId = typeof query.propertyId === 'string' ? query.propertyId : undefined

  let targetUserId = user.id

  if (propertyId) {
    const [property] = await db.select({
      id: properties.id,
      userId: properties.userId,
    }).from(properties).where(eq(properties.id, propertyId)).limit(1)

    if (!property) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Property not found',
      })
    }

    if (user.role === Role.OWNER && property.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
      })
    }

    targetUserId = property.userId
  }

  const templates = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.userId, targetUserId))
  const accessibleProperties = await (user.role === Role.OWNER
    ? db.select({
        id: properties.id,
        name: properties.name,
        billingWhatsappTemplateId: properties.billingWhatsappTemplateId,
        reminderOverdueWhatsappTemplateId: properties.reminderOverdueWhatsappTemplateId,
        reminderDueSoonWhatsappTemplateId: properties.reminderDueSoonWhatsappTemplateId,
        generalWhatsappTemplateId: properties.generalWhatsappTemplateId,
      }).from(properties).where(eq(properties.userId, user.id))
    : db.select({
        id: properties.id,
        name: properties.name,
        billingWhatsappTemplateId: properties.billingWhatsappTemplateId,
        reminderOverdueWhatsappTemplateId: properties.reminderOverdueWhatsappTemplateId,
        reminderDueSoonWhatsappTemplateId: properties.reminderDueSoonWhatsappTemplateId,
        generalWhatsappTemplateId: properties.generalWhatsappTemplateId,
      }).from(properties))

  const templatesWithMappings = templates.map((template) => {
    const fieldName = PROPERTY_WHATSAPP_TEMPLATE_FIELD_MAP[template.templateType]
    const mappedProperties = accessibleProperties.filter((property) => property[fieldName] === template.id)

    return {
      ...template,
      mappedPropertyIds: mappedProperties.map((property) => property.id),
      mappedPropertyNames: mappedProperties.map((property) => property.name),
    }
  })

  return {
    templates: templatesWithMappings
  }
})
