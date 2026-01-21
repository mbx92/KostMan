import { requireRole, Role } from '../../../utils/permissions'
import { db } from '../../../utils/drizzle'
import { whatsappTemplates } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

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
    const defaultTemplates: Record<string, { name: string; message: string }> = {
      billing: {
        name: 'Default Billing',
        message: `Halo {nama_penyewa},

Berikut tagihan kost Anda:

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran.
Terima kasih.`
      },
      reminder_overdue: {
        name: 'Default Overdue Reminder',
        message: `Halo {nama_penyewa},

⚠️ Tagihan Anda sudah LEWAT JATUH TEMPO.

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran.
Terima kasih.`
      },
      reminder_due_soon: {
        name: 'Default Due Soon Reminder',
        message: `Halo {nama_penyewa},

🔔 Pengingat: Tagihan Anda akan segera jatuh tempo.

{detail_tagihan}

{link_pembayaran}

Silakan lakukan pembayaran sebelum jatuh tempo.
Terima kasih.`
      },
      general: {
        name: 'Default General',
        message: `Halo {nama_penyewa},

{detail_tagihan}

{link_pembayaran}

Terima kasih.`
      }
    }

    return {
      template: {
        id: null,
        name: defaultTemplates[templateType]?.name || 'Default Template',
        message: defaultTemplates[templateType]?.message || '{detail_tagihan}\n\n{link_pembayaran}',
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
