import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID param' });
    }

    const result = await db.select().from(meterReadings).where(eq(meterReadings.id, id)).limit(1);

    if (!result.length) {
        throw createError({ statusCode: 404, statusMessage: 'Meter reading not found' });
    }

    return result[0];
});
