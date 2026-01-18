import { z } from 'zod';

// ============================================
// NEW CONSOLIDATED BILLING VALIDATION SCHEMAS
// ============================================

// Generate Bill Schema
export const generateBillSchema = z.object({
    roomId: z.string().uuid('Invalid room ID'),
    tenantId: z.string().uuid('Invalid tenant ID'),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period start must be in YYYY-MM-DD format'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period end must be in YYYY-MM-DD format'),
    includeRent: z.boolean().default(true), // Flag to include/exclude rent charges
    includeUtility: z.boolean().default(true), // Flag to include/exclude utility charges
    notes: z.string().optional(),
    additionalCharges: z.array(z.object({
        itemType: z.enum(['utility', 'others']).optional(), // Optional type override
        itemName: z.string().min(1, 'Item name is required'),
        itemQty: z.number().positive('Quantity must be positive'),
        itemUnitPrice: z.number().min(0, 'Unit price must be non-negative'),
        itemDiscount: z.number().min(0, 'Discount must be non-negative').default(0),
        notes: z.string().optional(),
    })).optional(),
}).refine(data => new Date(data.periodEnd) >= new Date(data.periodStart), {
    message: 'Period end must be greater than or equal to period start',
    path: ['periodEnd'],
});


// Update Bill Schema
export const updateBillSchema = z.object({
    billStatus: z.enum(['draft', 'unpaid', 'paid']).optional(),
    notes: z.string().optional(),
});

// Update Bill Period Schema
export const updateBillPeriodSchema = z.object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period start must be in YYYY-MM-DD format'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period end must be in YYYY-MM-DD format'),
}).refine(data => new Date(data.periodEnd) >= new Date(data.periodStart), {
    message: 'Period end must be greater than or equal to period start',
    path: ['periodEnd'],
});

// Record Payment Schema
export const recordPaymentSchema = z.object({
    paymentMethod: z.enum(['cash', 'online']),
    paymentAmount: z.number().positive('Payment amount must be positive'),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format'),
    paymentProof: z.string().optional(),
    notes: z.string().optional(),
});

// Query Bills Schema
export const queryBillsSchema = z.object({
    roomId: z.string().uuid().optional(),
    tenantId: z.string().uuid().optional(),
    billStatus: z.enum(['draft', 'unpaid', 'paid']).optional(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Add Billing Detail Schema
export const addBillingDetailSchema = z.object({
    itemType: z.enum(['rent', 'utility', 'others']),
    itemName: z.string().min(1, 'Item name is required'),
    itemQty: z.number().positive('Quantity must be positive'),
    itemUnitPrice: z.number().min(0, 'Unit price must be non-negative'),
    itemDiscount: z.number().min(0, 'Discount must be non-negative').default(0),
    notes: z.string().optional(),
});

// Update Billing Detail Schema
export const updateBillingDetailSchema = z.object({
    itemName: z.string().min(1).optional(),
    itemQty: z.number().positive().optional(),
    itemUnitPrice: z.number().min(0).optional(),
    itemDiscount: z.number().min(0).optional(),
    notes: z.string().optional(),
});

// ============================================
// OLD BILLING VALIDATION SCHEMAS (DEPRECATED)
// ============================================

export const rentBillGenerateSchema = z.object({
    roomId: z.string().uuid(),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}$/).optional(),
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
