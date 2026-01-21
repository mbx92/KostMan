import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants } from '../../database/schema';
import { tenantSchema } from '../../validations/tenant';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Parameter ID tidak ditemukan' });
    }

    const body = await readBody(event);
    const validatedData = tenantSchema.partial().parse(body);

    const result = await db.update(tenants)
        .set(validatedData)
        .where(eq(tenants.id, id))
        .returning();

    if (!result.length) {
        throw createError({ statusCode: 404, statusMessage: 'Penghuni tidak ditemukan' });
    }

    return result[0];
});
