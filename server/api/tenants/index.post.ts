import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants } from '../../database/schema';
import { tenantSchema } from '../../validations/tenant';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const validatedData = tenantSchema.parse(body);

    const result = await db.insert(tenants).values(validatedData).returning();
    return result[0];
});
