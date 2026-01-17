import { requireRole, Role } from '../../../utils/permissions';
import { db } from '../../../utils/drizzle';
import { bills, rooms, properties } from '../../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

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

    const billData = existingBill[0];

    // 2. Ownership verification (if not admin)
    if (user.role !== Role.ADMIN) {
        // Get room to verify property ownership
        const room = await db.select()
            .from(rooms)
            .where(eq(rooms.id, billData.roomId))
            .limit(1);

        if (room.length === 0) {
            throw createError({ statusCode: 404, statusMessage: 'Room not found' });
        }

        const property = await db.select()
            .from(properties)
            .where(eq(properties.id, room[0].propertyId))
            .limit(1);

        if (property.length === 0 || property[0].userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this property' });
        }
    }

    // 3. Prevent deletion of paid bills (optional business rule)
    if (billData.isPaid) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Cannot delete a paid bill. Please contact admin if you need to reverse this.'
        });
    }

    // 4. Delete bill
    await db.delete(bills).where(eq(bills.id, id));

    return { success: true, message: 'Bill deleted successfully' };
});
