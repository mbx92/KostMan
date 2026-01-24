import { H3Event, createError } from 'h3';

export const Role = {
    OWNER: 'owner',
    ADMIN: 'admin',
    STAFF: 'staff',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export function requireRole(event: H3Event, allowedRoles: RoleType[]) {
    const user = event.context.user;

    if (!user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No user found',
        });
    }

    if (!allowedRoles.includes(user.role)) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: Insufficient permissions',
        });
    }

    return user;
}

export function requireLogin(event: H3Event) {
    const user = event.context.user;

    if (!user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No user found',
        });
    }

    return user;
}
