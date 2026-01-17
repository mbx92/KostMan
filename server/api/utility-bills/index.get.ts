import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { utilityBills, rooms } from '../../database/schema';
import { eq, and, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const query = getQuery(event);
    const propertyId = query.propertyId as string | undefined;
    const isPaid = query.isPaid as string | undefined;
    const roomId = query.roomId as string | undefined;
    const period = query.period as string | undefined;

    const conditions = [];

    if (propertyId) {
        const roomsInProperty = await db.select({ id: rooms.id })
            .from(rooms)
            .where(eq(rooms.propertyId, propertyId));
        const roomIds = roomsInProperty.map(r => r.id);
        if (roomIds.length === 0) return [];
        conditions.push(inArray(utilityBills.roomId, roomIds));
    }

    if (roomId) {
        conditions.push(eq(utilityBills.roomId, roomId));
    }

    if (isPaid !== undefined) {
        conditions.push(eq(utilityBills.isPaid, isPaid === 'true'));
    }

    if (period) {
        conditions.push(eq(utilityBills.period, period));
    }

    const allBills = conditions.length > 0
        ? await db.select().from(utilityBills).where(and(...conditions))
        : await db.select().from(utilityBills);

    return allBills;
});
