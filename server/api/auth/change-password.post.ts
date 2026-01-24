import { users } from '../../database/schema';
import { db } from '../../utils/drizzle';
import { requireLogin } from '../../utils/permissions';
import { changePasswordSchema } from '../../validations/auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export default defineEventHandler(async (event) => {
    const sessionUser = requireLogin(event);
    const body = await readBody(event);

    const parseResult = changePasswordSchema.safeParse(body);
    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { currentPassword, newPassword } = parseResult.data;

    // Fetch full user data including password
    const userResult = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    const user = userResult[0];

    if (!user) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Password saat ini salah',
        });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.update(users)
        .set({
            password: hashedPassword,
            updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

    return { success: true, message: 'Password berhasil diubah' };
});
