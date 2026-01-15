
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties } from '../../database/schema';
import { propertySchema } from '../../validations/property';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing ID',
        });
    }

    // Check existence and permission
    const property = await db.select().from(properties).where(eq(properties.id, id)).limit(1);

    if (property.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Property not found',
        });
    }

    const targetProperty = property[0];

    if (user.role !== Role.ADMIN && targetProperty.userId !== user.id) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden',
        });
    }

    // Validate body
    const body = await readBody(event);
    const parseResult = propertySchema.partial().safeParse(body); // Allow partial updates for flexibility

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const updatedProperty = await db.update(properties)
        .set({
            ...parseResult.data,
            updatedAt: new Date(),
        })
        .where(eq(properties.id, id))
        .returning();

    return updatedProperty[0];
});
