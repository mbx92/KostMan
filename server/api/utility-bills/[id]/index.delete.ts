import { requireRole, Role } from '../../../utils/permissions';
import { db } from '../../../utils/drizzle';
import { utilityBills, rooms, properties } from '../../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    const existing = await db.select().from(utilityBills).where(eq(utilityBills.id, id)).limit(1);
    if (!existing.length) {
        throw createError({ statusCode: 404, statusMessage: 'Utility bill not found' });
    }

    const bill = existing[0];

    // Ownership verification
    if (user.role !== Role.ADMIN) {
        const room = await db.select().from(rooms).where(eq(rooms.id, bill.roomId)).limit(1);
        if (room.length > 0) {
            const property = await db.select().from(properties).where(eq(properties.id, room[0].propertyId)).limit(1);
            if (property.length === 0 || property[0].userId !== user.id) {
                throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
            }
        }
    }

    if (bill.isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Cannot delete a paid bill' });
    }

    await db.delete(utilityBills).where(eq(utilityBills.id, id));

    return { message: 'Utility bill deleted successfully' };
});
