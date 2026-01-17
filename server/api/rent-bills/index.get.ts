import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rentBills, rooms, tenants, properties } from '../../database/schema';
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
        conditions.push(inArray(rentBills.roomId, roomIds));
    }

    if (roomId) {
        conditions.push(eq(rentBills.roomId, roomId));
    }

    if (isPaid !== undefined) {
        conditions.push(eq(rentBills.isPaid, isPaid === 'true'));
    }

    if (period) {
        conditions.push(eq(rentBills.period, period));
    }

    const allBills = await db
        .select({
            bill: rentBills,
            tenant: tenants,
            room: rooms,
            property: properties,
        })
        .from(rentBills)
        .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
        .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

    return allBills;
});
