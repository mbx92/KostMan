
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties, meterReadings } from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const query = getQuery(event);
    const propertyId = query.propertyId as string | undefined;

    // Default to current month YYYY-MM if not provided
    const now = new Date();
    const currentPeriod = (query.period as string) ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentReadings = alias(meterReadings, 'current_readings');

    // Query to get Total Rooms and Total Recorded
    let baseQuery = db.select({
        total: sql<number>`count(distinct ${rooms.id})`,
        recorded: sql<number>`count(distinct ${currentReadings.roomId})`
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(currentReadings,
            and(
                eq(rooms.id, currentReadings.roomId),
                eq(currentReadings.period, currentPeriod)
            )
        );

    const conditions = [];

    // Filter by Property
    if (propertyId && propertyId !== '__all__') {
        conditions.push(eq(rooms.propertyId, propertyId));
    }

    // Role Restriction
    if (user.role === Role.OWNER) {
        conditions.push(eq(properties.userId, user.id));
    }

    if (conditions.length > 0) {
        baseQuery.where(and(...conditions));
    }

    const [result] = await baseQuery;

    const total = Number(result?.total || 0);
    const recorded = Number(result?.recorded || 0);

    return {
        total,
        recorded,
        pending: total - recorded
    };
});
