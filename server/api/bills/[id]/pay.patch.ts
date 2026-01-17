import { requireRole, Role } from '../../../utils/permissions';
import { db } from '../../../utils/drizzle';
import { bills } from '../../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Bill ID is required' });
    }

    // 1. Check if bill exists
    const existingBill = await db.select()
        .from(bills)
        .where(eq(bills.id, id))
        .limit(1);

    if (existingBill.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
    }

    // 2. Check if already paid
    if (existingBill[0].isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Bill is already marked as paid' });
    }

    // 3. Update bill to paid
    const updatedBill = await db.update(bills)
        .set({
            isPaid: true,
            paidAt: new Date(),
        })
        .where(eq(bills.id, id))
        .returning();

    return updatedBill[0];
});
