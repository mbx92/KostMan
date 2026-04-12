import { requireRole, Role } from '../../../utils/permissions'
import { db } from '../../../utils/drizzle'
import { whatsappTemplates } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'
import { getDefaultWhatsAppTemplate } from '../../../../shared/whatsapp-template-defaults'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const templateType = getRouterParam(event, 'type') as 'billing' | 'reminder_overdue' | 'reminder_due_soon' | 'general'

  if (!templateType) {
    throw createError({
      statusCode: 400,
      message: 'Template type is required'
    })
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
