import { z } from 'zod';

export const billGenerateSchema = z.object({
    roomId: z.string().uuid('Invalid room ID'),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}$/, 'Period end must be in YYYY-MM format').optional(),
    monthsCovered: z.number().int().min(1, 'Months covered must be at least 1').default(1),
    meterStart: z.number().int().nonnegative('Meter start must be a non-negative integer'),
    meterEnd: z.number().int().nonnegative('Meter end must be a non-negative integer'),
    costPerKwh: z.number().positive('Cost per kWh must be positive'),
    waterFee: z.number().nonnegative('Water fee must be non-negative'),
    trashFee: z.number().nonnegative('Trash fee must be non-negative'),
    additionalCost: z.number().nonnegative('Additional cost must be non-negative').default(0),
}).refine(data => data.meterEnd >= data.meterStart, {
    message: "Meter end must be greater than or equal to meter start",
    path: ["meterEnd"]
}).refine(data => {
    // If periodEnd is provided, validate it's after period
    if (data.periodEnd) {
        const periodDate = new Date(data.period + '-01');
        const periodEndDate = new Date(data.periodEnd + '-01');
        return periodEndDate >= periodDate;
    }
    return true;
}, {
    message: "Period end must be after or equal to period start",
    path: ["periodEnd"]
});

export type BillGenerateInput = z.infer<typeof billGenerateSchema>;
