import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { users } from '../../database/schema';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN]);

    // Exclude password from response
    const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
    }).from(users);

    return allUsers;
});
