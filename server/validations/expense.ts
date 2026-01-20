import { z } from "zod";

// Expense validation schemas
export const createExpenseSchema = z
    .object({
        propertyId: z.string().uuid().optional().nullable(),
        category: z.string().min(1).max(50),
        description: z.string().min(3).max(500),
        amount: z.number().positive(),
        type: z.enum(["property", "global"]),
        expenseDate: z.string().transform((val) => {
            // If it's already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
            // Otherwise, try to parse and format it
            const date = new Date(val);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date.toISOString().split('T')[0];
        }),
        paidDate: z.string().transform((val) => {
            if (!val) return null;
            // If it's already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
            // Otherwise, try to parse and format it
            const date = new Date(val);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date.toISOString().split('T')[0];
        }).optional().nullable(),
        isPaid: z.boolean().default(false),
        paymentMethod: z
            .enum(["cash", "transfer", "credit_card", "debit_card", "e_wallet"])
            .optional()
            .nullable(),
        receiptUrl: z.string().url().optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
    })
    .refine(
        (data) => {
            if (data.type === "property" && !data.propertyId) {
                return false;
            }
            return true;
        },
        {
            message: "Property expenses must have a propertyId",
            path: ["propertyId"],
        },
    )
    .refine(
        (data) => {
            if (data.paidDate && data.expenseDate) {
                return new Date(data.paidDate) >= new Date(data.expenseDate);
            }
            return true;
        },
        {
            message: "Paid date must be on or after expense date",
            path: ["paidDate"],
        },
    );


// Update schema - manually defined as partial since we can't use .partial() on schemas with refinements
export const updateExpenseSchema = z.object({
    propertyId: z.string().uuid().optional().nullable(),
    category: z.string().min(1).max(50).optional(),
    description: z.string().min(3).max(500).optional(),
    amount: z.number().positive().optional(),
    type: z.enum(["property", "global"]).optional(),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    isPaid: z.boolean().optional(),
    paymentMethod: z
        .enum(["cash", "transfer", "credit_card", "debit_card", "e_wallet"])
        .optional()
        .nullable(),
    receiptUrl: z.string().url().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
});


export const expenseQuerySchema = z.object({
    propertyId: z.string().uuid().optional(),
    type: z.enum(["property", "global"]).optional(),
    category: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isPaid: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    page: z
        .string()
        .transform((val) => parseInt(val, 10))
        .optional(),
    limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .optional(),
});

// Expense Category validation schemas
export const createExpenseCategorySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366f1"),
    isActive: z.boolean().default(true),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();
