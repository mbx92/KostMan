import { requireRole, Role } from '../../../utils/permissions';
import { db } from '../../../utils/drizzle';
import { rentBills } from '../../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);
    const id = getRouterParam(event, 'id');
    const body = await readBody<{ paymentMethod?: 'cash' | 'transfer' }>(event).catch(() => ({}));
    const paymentMethod = body.paymentMethod ?? 'cash';

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    if (!['cash', 'transfer'].includes(paymentMethod)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid payment method' });
    }

    const existing = await db.select().from(rentBills).where(eq(rentBills.id, id)).limit(1);
    if (!existing.length) {
        throw createError({ statusCode: 404, statusMessage: 'Rent bill not found' });
    }

    if (existing[0].isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Bill is already paid' });
    }

    const result = await db.update(rentBills).set({
        isPaid: true,
        paidAt: new Date(),
        paymentMethod,
    }).where(eq(rentBills.id, id)).returning();

    return result[0];
});
