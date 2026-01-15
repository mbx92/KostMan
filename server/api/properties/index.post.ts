
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties, propertySettings } from '../../database/schema';
import { propertySchema } from '../../validations/property';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const parseResult = propertySchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { name, address, description, image, mapUrl, costPerKwh, waterFee, trashFee } = parseResult.data;

    // Use transaction to ensure both are inserted or neither
    const newProperty = await db.transaction(async (tx) => {
        const insertedProperty = await tx.insert(properties).values({
            userId: user.id,
            name,
            address,
            description,
            image,
            mapUrl,
        }).returning();

        const propertyId = insertedProperty[0].id;

        // If any setting is provided, insert into propertySettings
        // Even if 0 is provided, it's valid. Only undefined skips if we consider optional.
        // But schema says NOT NULL for fees. So if we insert, we must provide all or defaults?
        // User schema: NOT NULL. Validation: Optional.
        // If user doesn't provide, we should probably set defaults or not insert row?
        // If the table row exists, it implies settings exist. If not, maybe use defaults?
        // Let's assume if any is provided, we insert row with 0 as default for missing ones.
        // Or if validation relies on optional, maybe we should treat them as required if we want to create settings?
        // Let's default to 0 for now if creating.

        if (costPerKwh !== undefined || waterFee !== undefined || trashFee !== undefined) {
            await tx.insert(propertySettings).values({
                propertyId,
                costPerKwh: costPerKwh?.toString() || '0',
                waterFee: waterFee?.toString() || '0',
                trashFee: trashFee?.toString() || '0',
            });
        }

        return insertedProperty[0];
    });

    return newProperty;
});
