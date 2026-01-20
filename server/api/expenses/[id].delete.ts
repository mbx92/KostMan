import { eq, and } from "drizzle-orm";
import { expenses } from "../../database/schema";
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

    // Verify expense ownership
    // Admin can delete any expense, Owner can only delete their own
    const whereConditions = user.role === 'admin'
        ? eq(expenses.id, id)
        : and(eq(expenses.id, id), eq(expenses.userId, user.id));

    const [existingExpense] = await db
        .select()
        .from(expenses)
        .where(whereConditions)
        .limit(1);

    if (!existingExpense) {
        throw createError({
            statusCode: 404,
            message: "Expense not found",
        });
    }

    // Delete expense
    await db.delete(expenses).where(eq(expenses.id, id));

    return {
        success: true,
        message: "Expense deleted successfully",
    };
});
