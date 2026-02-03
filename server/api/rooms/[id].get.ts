
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants, rooms, properties } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Get Room ID
    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    // 2. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    // 3. Fetch Room with Property Info for Ownership Check
    const roomResult = await db.select({
        room: rooms,
        property: properties,
        tenant: tenants
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(tenants, eq(rooms.tenantId, tenants.id))
        .where(eq(rooms.id, id))
        .limit(1);

    if (roomResult.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Room not found' });
    }

    const { room, property, tenant } = roomResult[0];

    // 4. Ownership Verification
    if (user.role === Role.OWNER) {
        if (property.userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
        }
    }

    // Staff might be restricted to their assigned property?
    // Current requirement doesn't specify Staff restrictions deeply ("Staff: Manage Payments/Bills only" in impl plan).
    // But usually staff are assigned to a site. For now, assuming if they can access bills, maybe they can see rooms.
    // The previous prompt context: "auditor: restrict to all units within their assigned site."
    // Let's keep it simple: Owner restricts to own property. Admin sees all. Staff sees all (or unrestricted for now as we don't have staff-property mapping yet other than bills).

    return {
        ...room,
        tenant
    };
});
