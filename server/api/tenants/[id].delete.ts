import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID param' });
    }

    const result = await db.delete(tenants)
        .where(eq(tenants.id, id))
        .returning();

    if (!result.length) {
        throw createError({ statusCode: 404, statusMessage: 'Tenant not found' });
    }

    return { message: 'Tenant deleted successfully' };
});
