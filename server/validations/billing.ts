import { z } from 'zod';

export const rentBillGenerateSchema = z.object({
    roomId: z.string().uuid(),

    // Date-based input (primary)
    periodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
    periodEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Auto-calculate if not provided
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Auto = periodEndDate

    monthsCovered: z.number().int().min(1).default(1),
    roomPrice: z.number().positive(),
});

export const utilityBillCreateSchema = z.object({
    roomId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
    meterStart: z.number().int().min(0),
    meterEnd: z.number().int().min(0),
    costPerKwh: z.number().positive(),
    waterFee: z.number().min(0),
    trashFee: z.number().min(0),
    additionalCost: z.number().min(0).default(0),
}).refine(data => data.meterEnd >= data.meterStart, {
    message: 'Meter end cannot be less than meter start',
    path: ['meterEnd'],
});
