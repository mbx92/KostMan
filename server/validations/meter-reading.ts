import { z } from 'zod';

export const meterReadingSchema = z.object({
    roomId: z.string().uuid('Invalid room ID'),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
    meterStart: z.number().int().nonnegative('Meter start must be a non-negative integer'),
    meterEnd: z.number().int().nonnegative('Meter end must be a non-negative integer'),
}).refine(data => data.meterEnd >= data.meterStart, {
    message: "Meter end must be greater than or equal to meter start",
    path: ["meterEnd"]
});

export const meterReadingUpdateSchema = z.object({
    meterStart: z.number().int().nonnegative('Meter start must be a non-negative integer').optional(),
    meterEnd: z.number().int().nonnegative('Meter end must be a non-negative integer').optional(),
}).refine(data => {
    if (data.meterStart !== undefined && data.meterEnd !== undefined) {
        return data.meterEnd >= data.meterStart;
    }
    return true;
}, {
    message: "Meter end must be greater than or equal to meter start",
    path: ["meterEnd"]
});

export type MeterReadingInput = z.infer<typeof meterReadingSchema>;
export type MeterReadingUpdateInput = z.infer<typeof meterReadingUpdateSchema>;
