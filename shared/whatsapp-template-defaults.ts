export type DefaultWhatsAppTemplateType = 'billing' | 'reminder_overdue' | 'reminder_due_soon' | 'general'

export interface DefaultWhatsAppTemplateDefinition {
  name: string
  templateType: DefaultWhatsAppTemplateType
  message: string
  isDefault: true
}

export const DEFAULT_WHATSAPP_TEMPLATE_MAP: Record<DefaultWhatsAppTemplateType, { name: string; message: string }> = {
  billing: {
    name: 'Tagihan Bulanan',
    message: `Halo {nama_penyewa},

Berikut detail tagihan Anda.

{detail_tagihan}

{link_pembayaran}

Mohon lakukan pembayaran sebelum jatuh tempo.
Terima kasih.`,
  },
  reminder_overdue: {
    name: 'Reminder Lewat Jatuh Tempo',
    message: `Halo {nama_penyewa},

Tagihan Anda sudah melewati jatuh tempo.

{detail_tagihan}

{link_pembayaran}

Mohon segera selesaikan pembayaran.
Terima kasih.`,
  },
  reminder_due_soon: {
    name: 'Reminder Jatuh Tempo Segera',
    message: `Halo {nama_penyewa},

Pengingat: tagihan Anda akan segera jatuh tempo.

{detail_tagihan}

{link_pembayaran}

Silakan lakukan pembayaran sebelum jatuh tempo.
Terima kasih.`,
  },
  general: {
    name: 'Template Umum',
    message: `Halo {nama_penyewa},

Berikut detail tagihan Anda.

{detail_tagihan}

{link_pembayaran}

Terima kasih.`,
  },
}

export function getDefaultWhatsAppTemplate(type: DefaultWhatsAppTemplateType) {
  return DEFAULT_WHATSAPP_TEMPLATE_MAP[type]
}

export function getAllDefaultWhatsAppTemplates(): DefaultWhatsAppTemplateDefinition[] {
  return (Object.keys(DEFAULT_WHATSAPP_TEMPLATE_MAP) as DefaultWhatsAppTemplateType[]).map((templateType) => ({
    templateType,
    isDefault: true,
    ...DEFAULT_WHATSAPP_TEMPLATE_MAP[templateType],
  }))
}