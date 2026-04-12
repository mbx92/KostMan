import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { whatsappTemplates } from '../../database/schema';
import { getAllDefaultWhatsAppTemplates } from '../../../shared/whatsapp-template-defaults';

/**
 * POST /api/whatsapp-templates/seed
 * Seed default WhatsApp templates for the current user
 */
export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    try {
        const templates = getAllDefaultWhatsAppTemplates().map((template) => ({
            ...template,
            userId: user.id,
        }));

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
