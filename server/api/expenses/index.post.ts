import { eq, and } from "drizzle-orm";
import { expenses, properties } from "../../database/schema";
import { createExpenseSchema } from "../../validations/expense";
import { db } from "../../utils/drizzle";

export default defineEventHandler(async (event) => {
    const user = event.context.user;
    if (!user) {
        throw createError({
            statusCode: 401,
            message: "Unauthorized",
        });
    }

    const body = await readBody(event);

    // Validate request body
    const validatedData = createExpenseSchema.parse(body);

    // Verify property ownership if it's a property expense
    if (validatedData.propertyId) {

        // Admin can create expenses for any property
        // Owner can only create expenses for their own properties
        const whereConditions = user.role === 'admin'
            ? eq(properties.id, validatedData.propertyId)
            : and(
                eq(properties.id, validatedData.propertyId),
                eq(properties.userId, user.id),
            );


        const property = await db
            .select()
            .from(properties)
            .where(whereConditions)
            .limit(1);


        if (!property.length) {
            throw createError({
                statusCode: 404,
                message: "Property not found",
            });
        }
    }

    // Create expense
    const [expense] = await db
        .insert(expenses)
        .values({
            ...validatedData,
            amount: validatedData.amount.toString(),
            userId: user.id,
        })
        .returning();

    return {
        success: true,
        expense,
    };
});
