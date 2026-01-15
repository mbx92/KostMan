import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Allow Admin and Owner
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    if (user.role === Role.ADMIN) {
        return await db.select().from(properties);
    } else {
        // Owner sees only their properties
        // Note: 'user' object from context might vary in structure depending on auth middleware.
        // Assuming user.id is available.
        return await db.select().from(properties).where(eq(properties.userId, user.id));
    }
});
