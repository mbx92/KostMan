
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { properties, propertySettings, whatsappTemplates } from '../../database/schema';
import { propertySchema } from '../../validations/property';
import { and, eq, inArray } from 'drizzle-orm';

async function validateTemplateOwnership(userId: string, templateIds: Array<string | null | undefined>, allowedExistingIds: string[] = []) {
    const normalizedIds = [...new Set(templateIds.filter((templateId): templateId is string => Boolean(templateId)))];
    const allowedIds = new Set(allowedExistingIds.filter(Boolean));
    const idsToValidate = normalizedIds.filter((templateId) => !allowedIds.has(templateId));

    if (idsToValidate.length === 0) {
        return;
    }

    const ownedTemplates = await db.select({ id: whatsappTemplates.id })
        .from(whatsappTemplates)
        .where(and(
            eq(whatsappTemplates.userId, userId),
            inArray(whatsappTemplates.id, idsToValidate),
        ));

    if (ownedTemplates.length !== idsToValidate.length) {
        throw createError({
            statusCode: 400,
            statusMessage: 'One or more WhatsApp templates are invalid for this property',
        });
    }
}

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
    const existingTemplateIds = [
        targetProperty.billingWhatsappTemplateId,
        targetProperty.reminderOverdueWhatsappTemplateId,
        targetProperty.reminderDueSoonWhatsappTemplateId,
        targetProperty.generalWhatsappTemplateId,
    ].filter((templateId): templateId is string => Boolean(templateId));

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

    const {
        name,
        address,
        description,
        image,
        mapUrl,
        billingWhatsappTemplateId,
        reminderOverdueWhatsappTemplateId,
        reminderDueSoonWhatsappTemplateId,
        generalWhatsappTemplateId,
        costPerKwh,
        waterFee,
        trashFee,
    } = parseResult.data;

    await validateTemplateOwnership(user.id, [
        billingWhatsappTemplateId,
        reminderOverdueWhatsappTemplateId,
        reminderDueSoonWhatsappTemplateId,
        generalWhatsappTemplateId,
    ], existingTemplateIds);

    const updatedProperty = await db.transaction(async (tx) => {
        const updated = await tx.update(properties)
            .set({
                name,
                address,
                description,
                image,
                mapUrl,
                billingWhatsappTemplateId,
                reminderOverdueWhatsappTemplateId,
                reminderDueSoonWhatsappTemplateId,
                generalWhatsappTemplateId,
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
