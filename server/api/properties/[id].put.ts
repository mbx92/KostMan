
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties, propertySettings } from '../../database/schema';
import { propertySchema } from '../../validations/property';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing ID',
        });
    }

    // Check existence and permission
    const property = await db.select().from(properties).where(eq(properties.id, id)).limit(1);

    if (property.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Property not found',
        });
    }

    const targetProperty = property[0];

    if (user.role !== Role.ADMIN && targetProperty.userId !== user.id) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden',
        });
    }

    // Validate body
    const body = await readBody(event);
    const parseResult = propertySchema.partial().safeParse(body); // Allow partial updates for flexibility

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { name, address, description, image, mapUrl, costPerKwh, waterFee, trashFee } = parseResult.data;

    const updatedProperty = await db.transaction(async (tx) => {
        const updated = await tx.update(properties)
            .set({
                name,
                address,
                description,
                image,
                mapUrl,
                updatedAt: new Date(),
            })
            .where(eq(properties.id, id))
            .returning();

        // Handle settings
        if (costPerKwh !== undefined || waterFee !== undefined || trashFee !== undefined) {
            // Check if settings exist
            const existingSettings = await tx.select().from(propertySettings).where(eq(propertySettings.propertyId, id));

            if (existingSettings.length > 0) {
                // Update
                const updateData: any = {};
                if (costPerKwh !== undefined) updateData.costPerKwh = costPerKwh.toString();
                if (waterFee !== undefined) updateData.waterFee = waterFee.toString();
                if (trashFee !== undefined) updateData.trashFee = trashFee.toString();

                await tx.update(propertySettings).set(updateData).where(eq(propertySettings.propertyId, id));
            } else {
                // Insert
                await tx.insert(propertySettings).values({
                    propertyId: id,
                    costPerKwh: costPerKwh?.toString() || '0',
                    waterFee: waterFee?.toString() || '0',
                    trashFee: trashFee?.toString() || '0',
                });
            }
        }

        return updated[0];
    });

    return updatedProperty;
});
