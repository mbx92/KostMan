import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { whatsappTemplates } from '../../database/schema';

/**
 * POST /api/whatsapp-templates/seed
 * Seed default WhatsApp templates for the current user
 */
export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    try {
        const templates = [
            {
                userId: user.id,
                name: 'Tagihan Bulanan',
                templateType: 'billing' as const,
                isDefault: true,
                message: `Halo {nama_penyewa},

Berikut tagihan kost Anda:

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran.
Terima kasih.`
            },
            {
                userId: user.id,
                name: 'Reminder Lewat Jatuh Tempo',
                templateType: 'reminder_overdue' as const,
                isDefault: true,
                message: `Halo {nama_penyewa},

*PEMBERITAHUAN PENTING*

Tagihan Anda sudah *LEWAT JATUH TEMPO*.

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran untuk menghindari denda.
Terima kasih.`
            },
            {
                userId: user.id,
                name: 'Reminder Jatuh Tempo Segera',
                templateType: 'reminder_due_soon' as const,
                isDefault: true,
                message: `Halo {nama_penyewa},

*PENGINGAT*

Tagihan Anda akan segera jatuh tempo.

{detail_tagihan}

{link_pembayaran}

Silakan lakukan pembayaran sebelum jatuh tempo.
Terima kasih!`
            },
            {
                userId: user.id,
                name: 'Template Umum',
                templateType: 'general' as const,
                isDefault: true,
                message: `Halo {nama_penyewa},

{detail_tagihan}

{link_pembayaran}

Terima kasih.`
            }
        ];

        // Insert templates
        for (const template of templates) {
            await db.insert(whatsappTemplates)
                .values(template)
                .onConflictDoNothing();
        }

        return {
            success: true,
            message: `${templates.length} template berhasil diimport`,
            count: templates.length
        };
    } catch (error: any) {
        console.error('Error seeding WhatsApp templates:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to seed WhatsApp templates',
            message: error.message
        });
    }
});
