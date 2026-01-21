import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Allow Admin, Owner, and Staff
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    if (user.role === Role.ADMIN || user.role === Role.STAFF) {
        // Admin and Staff can see all properties
        return await db.select().from(properties);
    } else {
        // Owner sees only their properties
        return await db.select().from(properties).where(eq(properties.userId, user.id));
    }
});
