import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties, propertySettings, rooms } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing ID',
        });
    }

    const result = await db.select({
        property: properties,
        settings: propertySettings,
        roomCount: sql<number>`(SELECT count(*) FROM ${rooms} WHERE ${rooms.propertyId} = ${properties.id})`.mapWith(Number),
        occupantCount: sql<number>`(SELECT count(*) FROM ${rooms} WHERE ${rooms.propertyId} = ${properties.id} AND ${rooms.status} = 'occupied')`.mapWith(Number),
    })
        .from(properties)
        .leftJoin(propertySettings, eq(properties.id, propertySettings.propertyId))
        .where(eq(properties.id, id))
        .limit(1);

    if (result.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Property not found',
        });
    }

    const { property: targetProperty, settings, roomCount, occupantCount } = result[0];

    // Check ownership if not Admin
    if (user.role !== Role.ADMIN && targetProperty.userId !== user.id) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden',
        });
    }

    const occupantPercentage = roomCount > 0 ? (occupantCount / roomCount) * 100 : 0;

    return {
        ...targetProperty,
        settings: settings || null,
        roomCount,
        occupantCount,
        occupantPercentage
    };
});
