import { expenseCategories } from "../../../database/schema";
import { createExpenseCategorySchema } from "../../../validations/expense";
import { db } from "../../../utils/drizzle";

export default defineEventHandler(async (event) => {
    const user = event.context.user;
    if (!user) {
        throw createError({
            statusCode: 401,
            message: "Unauthorized",
        });
    }

    const body = await readBody(event);
    const validatedData = createExpenseCategorySchema.parse(body);

    // Create category
    const [category] = await db
        .insert(expenseCategories)
        .values({
            ...validatedData,
            userId: user.id,
        })
        .returning();

    return {
        success: true,
        category,
    };
});
