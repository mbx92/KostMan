import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties, rooms } from '../../database/schema';
import { eq, sql, getTableColumns } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Allow Admin, Owner, and Staff
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const query = db.select({
        ...getTableColumns(properties),
        roomCount: sql<number>`count(${rooms.id})`.mapWith(Number)
    })
        .from(properties)
        .leftJoin(rooms, eq(properties.id, rooms.propertyId))
        .groupBy(properties.id);

    if (user.role === Role.ADMIN || user.role === Role.STAFF) {
        // Admin and Staff can see all properties
        return await query;
    } else {
        // Owner sees only their properties
        return await query.where(eq(properties.userId, user.id));
    }
});
