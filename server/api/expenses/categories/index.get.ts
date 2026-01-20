import { eq, desc } from "drizzle-orm";
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

    // Get user's custom categories
    const customCategories = await db
        .select()
        .from(expenseCategories)
        .where(eq(expenseCategories.userId, user.id))
        .orderBy(desc(expenseCategories.createdAt));

    // Default categories
    const defaultCategories = [
        { name: "maintenance", description: "Maintenance and repairs", color: "#ef4444", isDefault: true },
        { name: "utilities", description: "Utility bills", color: "#3b82f6", isDefault: true },
        { name: "supplies", description: "Supplies and materials", color: "#10b981", isDefault: true },
        { name: "salary", description: "Salaries and wages", color: "#f59e0b", isDefault: true },
        { name: "tax", description: "Taxes and fees", color: "#8b5cf6", isDefault: true },
        { name: "other", description: "Other expenses", color: "#6b7280", isDefault: true },
    ];

    return {
        success: true,
        categories: {
            default: defaultCategories,
            custom: customCategories,
        },
    };
});
