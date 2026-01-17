import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { bills, rooms } from '../../database/schema';
import { eq, and, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Staff can manage payment, so they need access to bills
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    // Get query parameters for filtering
    const query = getQuery(event);
    const propertyId = query.propertyId as string | undefined;
    const isPaid = query.isPaid as string | undefined;
    const billPeriod = query.billPeriod as string | undefined;

    // Build filter conditions
    const conditions = [];

    // Filter by propertyId (need to join with rooms table)
    if (propertyId) {
        const roomsInProperty = await db.select({ id: rooms.id })
            .from(rooms)
            .where(eq(rooms.propertyId, propertyId));

        const roomIds = roomsInProperty.map(r => r.id);

        if (roomIds.length === 0) {
            return []; // No rooms in this property
        }

        conditions.push(inArray(bills.roomId, roomIds));
    }

    // Filter by isPaid
    if (isPaid !== undefined) {
        conditions.push(eq(bills.isPaid, isPaid === 'true'));
    }

    // Filter by billPeriod
    if (billPeriod) {
        conditions.push(eq(bills.period, billPeriod));
    }

    // Apply filters or return all bills
    const allBills = conditions.length > 0
        ? await db.select().from(bills).where(and(...conditions))
        : await db.select().from(bills);

    return allBills;
});
