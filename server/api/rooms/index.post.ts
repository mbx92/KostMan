
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties } from '../../database/schema';
import { roomSchema } from '../../validations/room';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    // 2. Validate Body
    const body = await readBody(event);
    const parseResult = roomSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.errors,
        });
    }

    const input = parseResult.data;

    // 3. Ownership Verification
    // Check if the property belongs to the user (if Owner)
    // Admin can create for any property.
    if (user.role !== Role.ADMIN) {
        const property = await db.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);

        if (property.length === 0) {
            throw createError({ statusCode: 404, statusMessage: 'Property not found' });
        }

        if (property[0].userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this property' });
        }
    }

    // 4. Check Uniqueness (PropertyId + Name)
    // Though DB has constraint, it's nice to check here or catch DB error
    const existing = await db.select().from(rooms).where(
        and(eq(rooms.propertyId, input.propertyId), eq(rooms.name, input.name))
    ).limit(1);

    if (existing.length > 0) {
        throw createError({ statusCode: 409, statusMessage: 'Room name already exists in this property' });
    }

    // 5. Insert
    const newRoom = await db.insert(rooms).values({
        propertyId: input.propertyId,
        name: input.name,
        price: input.price.toString(),
        status: input.status as any ?? 'available',
        tenantId: input.tenantId ?? null,
        useTrashService: input.useTrashService ?? true,
        moveInDate: input.moveInDate ? input.moveInDate : null, // Drizzle handles string date usually
    }).returning();

    return newRoom[0];
});
