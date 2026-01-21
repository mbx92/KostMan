
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties, propertySettings, tenants } from '../../database/schema';
import { eq, and, like, count, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    // 2. Query Params
    const query = getQuery(event);
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const propertyId = query.propertyId as string | undefined;
    const status = query.status as string | undefined;
    const search = query.search as string | undefined; // Search by name

    // 3. Build Base Query Conditions
    let conditions = [];

    // Filter by Property ID
    if (propertyId) {
        conditions.push(eq(rooms.propertyId, propertyId));
    }

    // Filter by Status
    if (status) {
        conditions.push(eq(rooms.status, status));
    }

    // Search by Name
    if (search) {
        conditions.push(like(rooms.name, `%${search}%`));
    }

    // 4. Role-based Scope Restrictions
    if (user.role === Role.OWNER) {
        // Owners can only see rooms in their own properties
        // This requires a subquery or join condition check.
        // Easiest is to filter where property.userId is 'user.id'
        // But we are selecting 'rooms'. So we join properties to filter.
        // We are already joining properties below, but for the count query we need to be careful?
        // Actually we can add this condition to the main query logic.
    }

    // Construct the query
    // We want to join properties to get property details (and maybe property settings as requested "show all properties and setting on list")

    // Start with base selection
    let baseQuery = db.select({
        room: rooms,
        property: properties,
        settings: propertySettings,
        tenant: tenants,
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(propertySettings, eq(properties.id, propertySettings.propertyId))
        .leftJoin(tenants, eq(rooms.tenantId, tenants.id));

    // Apply Filters

    // Role Restriction Filter
    if (user.role === Role.OWNER) {
        conditions.push(eq(properties.userId, user.id));
    }

    // Combine all conditions
    if (conditions.length > 0) {
        baseQuery.where(and(...conditions));
    }

    // 5. Execute Count Query (for paging)
    // We can't reuse the select object easily for count in Drizzle 0.29 (needs to be constructed)
    // Simplified count query: join properties just for filtering owners
    let countQuery = db.select({ count: count() }).from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id));

    if (conditions.length > 0) {
        countQuery.where(and(...conditions));
    }

    const totalResult = await countQuery;
    const total = totalResult[0].count;

    // 6. Execute Main Query with Pagination
    const results = await baseQuery.limit(pageSize).offset(offset);

    // 7. Format Response
    return {
        data: results.map(row => ({
            ...row.room,
            tenantName: row.tenant?.name || null,
            property: {
                ...row.property,
                settings: row.settings || null
            }
        })),
        meta: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
});
