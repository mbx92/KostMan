
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties } from '../../database/schema';
import { propertySchema } from '../../validations/property';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const parseResult = propertySchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { name, address, description, image, mapUrl } = parseResult.data;

    // Use the authenticated user's ID as the owner
    const newProperty = await db.insert(properties).values({
        userId: user.id, // Assumes user.id is present in the context user object
        name,
        address,
        description,
        image,
        mapUrl,
    }).returning();

    return newProperty[0];
});
