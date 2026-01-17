import { requireRole, Role } from '../../../utils/permissions';
import { db } from '../../../utils/drizzle';
import { utilityBills } from '../../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    const existing = await db.select().from(utilityBills).where(eq(utilityBills.id, id)).limit(1);
    if (!existing.length) {
        throw createError({ statusCode: 404, statusMessage: 'Utility bill not found' });
    }

    if (existing[0].isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Bill is already paid' });
    }

    const result = await db.update(utilityBills).set({
        isPaid: true,
        paidAt: new Date()
    }).where(eq(utilityBills.id, id)).returning();

    return result[0];
});
