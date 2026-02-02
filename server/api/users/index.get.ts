import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { users } from '../../database/schema';
import { userQuerySchema } from '../../validations/users';
import { and, eq, ilike, or, sql, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const query = getQuery(event);
    const validatedQuery = userQuerySchema.parse(query);

    const conditions = [];

    if (validatedQuery.role) {
        conditions.push(eq(users.role, validatedQuery.role));
    }

    if (validatedQuery.status) {
        conditions.push(eq(users.status, validatedQuery.status));
    }

    if (validatedQuery.search) {
        const searchPattern = `%${validatedQuery.search}%`;
        conditions.push(
            or(
                ilike(users.name, searchPattern),
                ilike(users.email, searchPattern)
            )
        );
    }

    // Pagination
    const page = validatedQuery.page || 1;
    const limit = validatedQuery.limit || 10;
    const offset = (page - 1) * limit;

    const [allUsers, [{ count }]] = await Promise.all([
        db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            status: users.status,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        })
            .from(users)
            .where(and(...conditions))
            .limit(limit)
            .offset(offset)
            .orderBy(desc(users.createdAt)),

        db.select({ count: sql<number>`count(*)` })
            .from(users)
            .where(and(...conditions))
    ]);

    return {
        success: true,
        users: allUsers,
        pagination: {
            page,
            limit,
            total: Number(count),
            totalPages: Math.ceil(Number(count) / limit)
        }
    };
});
