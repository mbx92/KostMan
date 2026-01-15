
import { users } from '../../database/schema';
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { registerSchema } from '../../validations/auth';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN]);

    const body = await readBody(event);

    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { email, password, name } = parseResult.data;

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
        throw createError({
            statusCode: 409,
            statusMessage: 'User already exists',
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.insert(users).values({
        email,
        password: hashedPassword,
        name,
        role: Role.OWNER, // default role
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    return newUser[0];
});
