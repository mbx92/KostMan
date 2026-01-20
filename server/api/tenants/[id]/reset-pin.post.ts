import { db } from '../../../utils/drizzle';
import { tenants } from '../../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Tenant ID is required',
        });
    }

    // Find tenant first
    const tenant = await db.select()
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);

    if (tenant.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Tenant not found',
        });
    }

    // Reset PIN by setting it to null and marking as default
    // The login flow will use the default PIN (last 4 digits of phone) when pin is null
    const [updated] = await db.update(tenants)
        .set({ 
            pin: null,
            isDefaultPin: true 
        })
        .where(eq(tenants.id, id))
        .returning();

    // Calculate what the default PIN will be (last 4 digits of contact)
    const contact = updated.contact || '';
    const digits = contact.replace(/\D/g, '');
    const defaultPin = digits.slice(-4);

    return {
        success: true,
        message: 'PIN berhasil direset ke default',
        defaultPin: defaultPin, // Show admin what the new PIN is
    };
});
