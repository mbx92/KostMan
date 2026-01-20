import { eq, and } from "drizzle-orm";
import { expenses, properties } from "../../database/schema";
import { updateExpenseSchema } from "../../validations/expense";
import { db } from "../../utils/drizzle";

export default defineEventHandler(async (event) => {
    const user = event.context.user;
    if (!user) {
        throw createError({
            statusCode: 401,
            message: "Unauthorized",
        });
    }

    const id = getRouterParam(event, "id");
    if (!id) {
        throw createError({
            statusCode: 400,
            message: "Expense ID is required",
        });
    }

    const body = await readBody(event);
    const validatedData = updateExpenseSchema.parse(body);

    // Verify expense ownership
    // Admin can edit any expense, Owner can only edit their own
    const expenseWhereConditions = user.role === 'admin'
        ? eq(expenses.id, id)
        : and(eq(expenses.id, id), eq(expenses.userId, user.id));

    const [existingExpense] = await db
        .select()
        .from(expenses)
        .where(expenseWhereConditions)
        .limit(1);

    if (!existingExpense) {
        throw createError({
            statusCode: 404,
            message: "Expense not found",
        });
    }

    // Verify property ownership if propertyId is being updated
    if (validatedData.propertyId) {
        // Admin can use any property, Owner can only use their own properties
        const propertyWhereConditions = user.role === 'admin'
            ? eq(properties.id, validatedData.propertyId)
            : and(
                eq(properties.id, validatedData.propertyId),
                eq(properties.userId, user.id),
            );

        const property = await db
            .select()
            .from(properties)
            .where(propertyWhereConditions)
            .limit(1);

        if (!property.length) {
            throw createError({
                statusCode: 404,
                message: "Property not found",
            });
        }
    }

    // Update expense
    const updateData: any = { ...validatedData };
    if (updateData.amount !== undefined) {
        updateData.amount = updateData.amount.toString();
    }

    const [updatedExpense] = await db
        .update(expenses)
        .set(updateData)
        .where(eq(expenses.id, id))
        .returning();

    return {
        success: true,
        expense: updatedExpense,
    };
});
