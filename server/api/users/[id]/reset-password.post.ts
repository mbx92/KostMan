import { users } from '../../../database/schema';
import { requireRole, Role } from '../../../utils/permissions';
import { db } from '../../../utils/drizzle';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);

    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing ID parameter',
        });
    }

    // Generate a secure random password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await db.update(users)
        .set({
            password: hashedPassword,
            updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning({ id: users.id, email: users.email });

    if (updatedUser.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        });
    }

    // Return the new password so the admin can inform the user
    return {
        success: true,
        newPassword,
        message: 'Password reset successfully. Please share this new password with the user.'
    };
});
