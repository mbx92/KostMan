import { eq, and } from "drizzle-orm";
import { expenseCategories } from "../../../database/schema";
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

    // Delete category
    await db.delete(expenseCategories).where(eq(expenseCategories.id, id));

    return {
        success: true,
        message: "Category deleted successfully",
    };
});
