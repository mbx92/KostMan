import { z } from 'zod';

export const tenantSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    contact: z.string().min(1, 'Contact is required').max(20),
    idCardNumber: z.string().length(16, 'ID Card Number must be 16 characters'),
    status: z.enum(['active', 'inactive']).optional().default('active'),
});

export type TenantInput = z.infer<typeof tenantSchema>;
