
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties } from '../../database/schema';
import { roomSchema } from '../../validations/room';
import { eq, and, ne } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Get Room ID
    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    // 2. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    // 3. Validate Body
    const body = await readBody(event);
    const parseResult = roomSchema.partial().safeParse(body); // Partial for updates

    if (!parseResult.success) {
        throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: parseResult.error.errors });
    }

    const input = parseResult.data;

    // 4. Ownership Verification
    const currentRoomResult = await db.select({
        room: rooms,
        property: properties
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(rooms.id, id))
        .limit(1);

    if (currentRoomResult.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Room not found' });
    }

    const { property, room } = currentRoomResult[0];

    if (user.role !== Role.ADMIN) {
        if (property.userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
        }
    }

    // 5. Check Uniqueness (if name is being updated)
    if (input.name) {
        const existing = await db.select().from(rooms).where(
            and(
                eq(rooms.propertyId, property.id),
                eq(rooms.name, input.name),
                ne(rooms.id, id) // Exclude self
            )
        ).limit(1);

        if (existing.length > 0) {
            throw createError({ statusCode: 409, statusMessage: 'Room name already exists in this property' });
        }
    }

    // 6. Update
    const updatedRoom = await db.update(rooms).set({
        ...input,
        price: input.price ? input.price.toString() : undefined,
        status: input.status as any,
    }).where(eq(rooms.id, id)).returning();

    return updatedRoom[0];
});
