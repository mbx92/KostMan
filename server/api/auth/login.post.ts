
import { users } from '../../database/schema';
import { db } from '../../utils/drizzle';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { loginSchema } from '../../validations/auth';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);

    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { email, password } = parseResult.data;

    const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userResult[0];

    if (!user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid credentials',
        });
    }

    if (user.status === 'suspended') {
        throw createError({
            statusCode: 403,
            statusMessage: 'Account suspended. Please contact administrator.',
        });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid credentials',
        });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || process.env.NUXT_SESSION_PASSWORD || 'default_secret',
        { expiresIn: '7d' }
    );

    // Detect if request came over HTTPS
    const isSecure = getRequestURL(event).protocol === 'https:' || 
                     getRequestHeader(event, 'x-forwarded-proto') === 'https'

    setCookie(event, 'auth_token', token, {
        httpOnly: true,
        secure: isSecure,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        path: '/',
    });

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        }
    };
});
