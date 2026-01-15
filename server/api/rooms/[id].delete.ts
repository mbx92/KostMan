
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Get Room ID
    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    // 2. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    // 3. Ownership Verification
    const roomResult = await db.select({
        room: rooms,
        property: properties
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(rooms.id, id))
        .limit(1);

    if (roomResult.length === 0) {
        // Idempotency: if already deleted, return success or 404? 
        // 404 is standard for REST if resource is gone.
        throw createError({ statusCode: 404, statusMessage: 'Room not found' });
    }

    const { property } = roomResult[0];

    if (user.role !== Role.ADMIN) {
        if (property.userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
        }
    }

    // 4. Delete
    await db.delete(rooms).where(eq(rooms.id, id));

    return { message: 'Room deleted successfully' };
});
