import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);

    const query = getQuery(event);
    const status = query.status as string | undefined;

    if (status && (status === 'active' || status === 'inactive')) {
        return await db.select().from(tenants).where(eq(tenants.status, status));
    }

    return await db.select().from(tenants);
});
