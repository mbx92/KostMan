import { eq, and } from "drizzle-orm";
import { expenseCategories } from "../../../database/schema";
import { updateExpenseCategorySchema } from "../../../validations/expense";
import { db } from "../../../utils/drizzle";

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
            message: "Category ID is required",
        });
    }

    const body = await readBody(event);
    const validatedData = updateExpenseCategorySchema.parse(body);

    // Verify category ownership
    const [existingCategory] = await db
        .select()
        .from(expenseCategories)
        .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, user.id)))
        .limit(1);

    if (!existingCategory) {
        throw createError({
            statusCode: 404,
            message: "Category not found",
        });
    }

    // Update category
    const [updatedCategory] = await db
        .update(expenseCategories)
        .set(validatedData)
        .where(eq(expenseCategories.id, id))
        .returning();

    return {
        success: true,
        category: updatedCategory,
    };
});
