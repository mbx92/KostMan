import { db } from '../../utils/drizzle';
import { users } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        });
    }

    // Get full user details from database
    const userId = event.context.user.id;
    const userResult = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (userResult.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        });
    }

    return { user: userResult[0] };
});
