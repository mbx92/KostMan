
import { z } from 'zod';

export const roomSchema = z.object({
    propertyId: z.string().uuid('Invalid property ID'),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    price: z.number().nonnegative('Price must be non-negative'),
    status: z.enum(['available', 'occupied', 'maintenance']).optional(),
    tenantId: z.string().uuid('Invalid tenant ID').optional(),
    useTrashService: z.boolean().optional(),
    moveInDate: z.string().date().optional(), // Zod 'date' string validation (YYYY-MM-DD)
    occupantCount: z.number().int().min(1).max(10).optional().default(1),
});

export type RoomInput = z.infer<typeof roomSchema>;
