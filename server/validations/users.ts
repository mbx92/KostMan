import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['owner', 'admin', 'staff']).default('staff'),
});

export const updateUserSchema = z.object({
    email: z.string().email('Invalid email address').optional(),
    name: z.string().min(1, 'Name is required').optional(),
    role: z.enum(['owner', 'admin', 'staff']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
});

export const userQuerySchema = z.object({
    role: z.enum(['owner', 'admin', 'staff']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    search: z.string().optional(),
    page: z
        .string()
        .transform((val) => parseInt(val, 10))
        .optional(),
    limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
