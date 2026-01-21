import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants, rooms, properties } from '../../database/schema';
import { eq, like, or, sql, and, count } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const query = getQuery(event);
    const status = query.status as string | undefined;
    const search = query.search as string | undefined;
    const page = parseInt(query.page as string) || 1;
    const pageSize = parseInt(query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [];

    // Status filter
    if (status && (status === 'active' || status === 'inactive')) {
        conditions.push(eq(tenants.status, status));
    }

    // Search filter (name, contact, idCardNumber)
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        conditions.push(
            or(
                like(tenants.name, searchTerm),
                like(tenants.contact, searchTerm),
                like(tenants.idCardNumber, searchTerm)
            )
        );
    }

    // Combine conditions with AND
    const whereClause = conditions.length > 0 
        ? and(...conditions) 
        : undefined;

    // Get total count
    const [{ value: total }] = await db
        .select({ value: count() })
        .from(tenants)
        .where(whereClause);

    // Get paginated data with room and property info
    const data = await db
        .select({
            tenant: tenants,
            room: rooms,
            property: properties
        })
        .from(tenants)
        .leftJoin(rooms, and(eq(tenants.id, rooms.tenantId), eq(rooms.status, 'occupied')))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(whereClause)
        .limit(pageSize)
        .offset(offset)
        .orderBy(tenants.name);

    // Format the response
    const formattedData = data.map(row => ({
        ...row.tenant,
        assignedRoom: row.room ? {
            id: row.room.id,
            name: row.room.name,
            propertyId: row.room.propertyId,
            propertyName: row.property?.name || null
        } : null
    }));

    return {
        data: formattedData,
        meta: {
            page,
            pageSize,
            total: Number(total),
            totalPages: Math.ceil(Number(total) / pageSize)
        }
    };
});
