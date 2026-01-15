import { z } from 'zod';

export const propertySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    address: z.string().min(1, 'Address is required'),
    description: z.string().optional(),
    image: z.string().url('Invalid URL').optional().or(z.literal('')),
    mapUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
    costPerKwh: z.number().nonnegative().optional(),
    waterFee: z.number().nonnegative().optional(),
    trashFee: z.number().nonnegative().optional(),
});

export type PropertyInput = z.infer<typeof propertySchema>;
