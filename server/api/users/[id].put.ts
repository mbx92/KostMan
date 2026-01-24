import { users } from '../../database/schema';
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { eq, ne, and } from 'drizzle-orm';
import { updateUserSchema } from '../../validations/users';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);

    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing ID parameter',
        });
    }

    const body = await readBody(event);
    const parseResult = updateUserSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { email, name, role, status } = parseResult.data;
    const updateData: any = { updatedAt: new Date() }; // Force update timestamp

    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existingUser.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        });
    }

    // Restriction: Cannot suspend Owner or yourself if you are an admin (though logic allows updating self, usually suspension is by others)
    // Actually, prevent suspending Owners.
    if (status === 'suspended' && existingUser[0].role === Role.OWNER) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Cannot suspend an Owner account',
        });
    }

    // If email is changing, check for duplicates
    if (email && email !== existingUser[0].email) {
        const emailCheck = await db.select().from(users).where(
            and(
                eq(users.email, email),
                ne(users.id, id)
            )
        ).limit(1);

        if (emailCheck.length > 0) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Email already in use',
            });
        }
    }

    const updatedUser = await db.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            status: users.status,
            updatedAt: users.updatedAt
        });

    return updatedUser[0];
});
