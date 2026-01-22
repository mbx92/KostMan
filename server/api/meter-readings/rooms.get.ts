
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties, meterReadings, tenants } from '../../database/schema';
import { eq, and, like, or, sql, isNull, isNotNull, desc, asc, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const query = getQuery(event);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const propertyId = query.propertyId as string | undefined;
    const search = query.search as string | undefined;
    const status = query.status as string | undefined; // 'recorded' | 'unrecorded' | 'all'

    // Default to current month YYYY-MM if not provided
    const now = new Date();
    const currentPeriod = (query.period as string) ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Helper for Status Check
    // We explicitly join meter_readings for the *current period* to determine status
    const currentReadings = alias(meterReadings, 'current_readings');

    // Base Selection
    let baseQuery = db.select({
        room: rooms,
        property: properties,
        tenant: tenants,
        // We can select the ID of the current reading to check existence
        currentReadingId: currentReadings.id,
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(tenants, eq(rooms.tenantId, tenants.id))
        .leftJoin(currentReadings,
            and(
                eq(rooms.id, currentReadings.roomId),
                eq(currentReadings.period, currentPeriod)
            )
        );

    // Conditions
    const conditions = [];

    // 1. Property Filter
    if (propertyId && propertyId !== '__all__') {
        conditions.push(eq(rooms.propertyId, propertyId));
    }

    // 2. Role Restriction
    if (user.role === Role.OWNER) {
        conditions.push(eq(properties.userId, user.id));
    }

    // 3. Search Filter (Room Name, Property Name, or Tenant Name)
    if (search) {
        const lowerSearch = `%${search.toLowerCase()}%`;
        conditions.push(or(
            like(sql`lower(${rooms.name})`, lowerSearch),
            like(sql`lower(${properties.name})`, lowerSearch),
            like(sql`lower(${tenants.name})`, lowerSearch)
        ));
    }

    // 4. Status Filter
    if (status === 'recorded') {
        conditions.push(isNotNull(currentReadings.id));
    } else if (status === 'unrecorded') {
        conditions.push(isNull(currentReadings.id));
    }

    // Apply conditions
    if (conditions.length > 0) {
        baseQuery.where(and(...conditions));
    }

    // --- Pagination: Count Queries ---
    // Efficient count requires a separate query or window function. 
    // Drizzle doesn't support window count easily in select(), so we clone the conditions.

    // We can't easily clone the selection object to a count query in Drizzle yet without reconstructing.
    // So we reconstruct the count query with the same joins and conditions.
    const countQuery = db.select({ count: sql<number>`count(distinct ${rooms.id})` })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(tenants, eq(rooms.tenantId, tenants.id))
        .leftJoin(currentReadings,
            and(
                eq(rooms.id, currentReadings.roomId),
                eq(currentReadings.period, currentPeriod)
            )
        );

    if (conditions.length > 0) {
        countQuery.where(and(...conditions));
    }

    const [totalResult] = await countQuery;
    const total = Number(totalResult?.count || 0);

    // --- Execute Main Query ---
    // Add sorting (default by room Name)
    const results = await baseQuery
        .orderBy(asc(rooms.name))
        .limit(pageSize)
        .offset(offset);

    // --- Fetch Latest Readings for these rooms ---
    // We need the "Last Inserted Record" (Periode Terakhir) regardless of the current period filter.
    // We query meterReadings for the returned room IDs.

    const roomIds = results.map(r => r.room.id);
    const roomMap = new Map();

    // Prepare result objects
    results.forEach(r => {
        roomMap.set(r.room.id, {
            ...r.room,
            tenantName: r.tenant?.name || null,
            property: r.property,
            // Info for current period
            currentPeriodStatus: r.currentReadingId ? 'recorded' : 'unrecorded',
            lastReading: null as any // To be filled
        });
    });

    if (roomIds.length > 0) {
        // Find latest reading for each room
        // Strategy: Use a window function in a CTE or just distinct on in query
        // "SELECT DISTINCT ON (room_id) * FROM meter_readings WHERE room_id IN ... ORDER BY room_id, period DESC"

        const latestReadings = await db.select()
            .from(meterReadings)
            .where(inArray(meterReadings.roomId, roomIds))
            .orderBy(meterReadings.roomId, desc(meterReadings.period));

        // Process in code to pick top 1 per room (since Drizzle distinctOn support might vary or be complex typed)
        // Actually we can just map them. Since we ordered by properties (roomid, period desc), 
        // usage of a map will overwrite? No, we want the FIRST one we see.

        const latestMap = new Map();
        for (const reading of latestReadings) {
            if (!latestMap.has(reading.roomId)) {
                latestMap.set(reading.roomId, reading);
            }
        }

        // Attach to rooms
        for (const [id, roomObj] of roomMap) {
            const reading = latestMap.get(id);
            if (reading) {
                roomObj.lastMeterStart = reading.meterStart; // Added
                roomObj.lastMeterEnd = reading.meterEnd;
                roomObj.lastPeriod = reading.period;
                roomObj.lastRecordedAt = reading.recordedAt;
            } else {
                roomObj.lastMeterStart = null; // Added
                roomObj.lastMeterEnd = null;
                roomObj.lastPeriod = null;
                roomObj.lastRecordedAt = null;
            }
        }
    }

    return {
        data: Array.from(roomMap.values()),
        meta: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
});
