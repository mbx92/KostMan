import { eq, and, gte, lte, desc, isNull, sql } from "drizzle-orm";
import { expenses, properties } from "../../database/schema";
import { expenseQuerySchema } from "../../validations/expense";
import { db } from "../../utils/drizzle";

export default defineEventHandler(async (event) => {
    const user = event.context.user;
    if (!user) {
        throw createError({
            statusCode: 401,
            message: "Unauthorized",
        });
    }

    const query = getQuery(event);
    const validatedQuery = expenseQuerySchema.parse(query);

    // Build where conditions
    const conditions = [eq(expenses.userId, user.id)];

    if (validatedQuery.propertyId) {
        if (validatedQuery.propertyId === "global") {
            conditions.push(isNull(expenses.propertyId));
        } else {
            conditions.push(eq(expenses.propertyId, validatedQuery.propertyId));
        }
    }

    if (validatedQuery.type) {
        conditions.push(eq(expenses.type, validatedQuery.type));
    }

    if (validatedQuery.category) {
        conditions.push(eq(expenses.category, validatedQuery.category));
    }

    if (validatedQuery.startDate) {
        conditions.push(gte(expenses.expenseDate, validatedQuery.startDate));
    }

    if (validatedQuery.endDate) {
        conditions.push(lte(expenses.expenseDate, validatedQuery.endDate));
    }

    if (validatedQuery.isPaid !== undefined) {
        conditions.push(eq(expenses.isPaid, validatedQuery.isPaid));
    }

    // Calculate pagination
    const page = validatedQuery.page || 1;
    const limit = validatedQuery.limit || 20;
    const offset = (page - 1) * limit;

    // Fetch expenses with property details
    const expensesList = await db
        .select({
            id: expenses.id,
            propertyId: expenses.propertyId,
            propertyName: properties.name,
            category: expenses.category,
            description: expenses.description,
            amount: expenses.amount,
            type: expenses.type,
            expenseDate: expenses.expenseDate,
            paidDate: expenses.paidDate,
            isPaid: expenses.isPaid,
            paymentMethod: expenses.paymentMethod,
            receiptUrl: expenses.receiptUrl,
            notes: expenses.notes,
            createdAt: expenses.createdAt,
            updatedAt: expenses.updatedAt,
        })
        .from(expenses)
        .leftJoin(properties, eq(expenses.propertyId, properties.id))
        .where(and(...conditions))
        .orderBy(desc(expenses.expenseDate))
        .limit(limit)
        .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(expenses)
        .where(and(...conditions));

    return {
        success: true,
        expenses: expensesList,
        pagination: {
            page,
            limit,
            total: Number(count),
            totalPages: Math.ceil(Number(count) / limit),
        },
    };
});
