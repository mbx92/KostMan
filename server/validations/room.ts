
import { z } from 'zod';

export const roomSchema = z.object({
    propertyId: z.string().uuid('Invalid property ID'),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    price: z.number().nonnegative('Price must be non-negative'),
    status: z.enum(['available', 'occupied', 'maintenance']).optional(),
    tenantId: z.string().uuid('Invalid tenant ID').nullish(), // Allow null and undefined
    useTrashService: z.boolean().optional(),
    moveInDate: z.string().date().nullish(), // Allow null and undefined
    occupantCount: z.number().int().min(1).max(10).optional().default(1),
    overrideSettings: z.boolean().optional(),
    costPerKwh: z.number().nonnegative('Cost per kWh must be non-negative').optional(),
    waterFee: z.number().nonnegative('Water fee must be non-negative').optional(),
    trashFee: z.number().nonnegative('Trash fee must be non-negative').optional(),
});

export type RoomInput = z.infer<typeof roomSchema>;
