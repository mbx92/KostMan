
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties, rentBills } from '../../database/schema';
import { roomSchema } from '../../validations/room';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    // 2. Validate Body
    const body = await readBody(event);
    const parseResult = roomSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const input = parseResult.data;

    // 3. Ownership Verification
    // Check if the property belongs to the user (if Owner)
    // Admin can create for any property.
    if (user.role !== Role.ADMIN) {
        const property = await db.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1);

        if (property.length === 0) {
            throw createError({ statusCode: 404, statusMessage: 'Property not found' });
        }

        if (property[0].userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this property' });
        }
    }

    // 4. Check Uniqueness (PropertyId + Name)
    // Though DB has constraint, it's nice to check here or catch DB error
    const existing = await db.select().from(rooms).where(
        and(eq(rooms.propertyId, input.propertyId), eq(rooms.name, input.name))
    ).limit(1);

    if (existing.length > 0) {
        throw createError({ statusCode: 409, statusMessage: 'Room name already exists in this property' });
    }

    // 5. Insert
    const newRoom = await db.insert(rooms).values({
        propertyId: input.propertyId,
        name: input.name,
        price: input.price.toString(),
        status: input.status as any ?? 'available',
        tenantId: input.tenantId ?? null,
        useTrashService: input.useTrashService ?? true,
        moveInDate: input.moveInDate ? input.moveInDate : null, // Drizzle handles string date usually
    }).returning();

    // 6. Auto-generate first rent bill if moveInDate and tenantId are provided
    if (input.moveInDate && input.tenantId && newRoom[0]) {
        try {
            // Parse moveInDate to get periodStartDate and calculate periodEndDate
            const moveInDate = input.moveInDate; // YYYY-MM-DD
            const startDate = new Date(moveInDate + 'T00:00:00');
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(endDate.getDate() - 1);
            
            const periodStartDate = moveInDate;
            const periodEndDate = endDate.toISOString().slice(0, 10);
            const dueDate = periodEndDate;
            
            // Extract billing cycle day from moveInDate
            const billingCycleDay = startDate.getDate();
            
            // Generate legacy period (YYYY-MM) for backward compatibility
            const period = moveInDate.slice(0, 7);
            
            // Calculate total amount
            const roomPrice = Number(input.price);
            const totalAmount = roomPrice; // First month, no proration for now
            
            // Insert first rent bill
            await db.insert(rentBills).values({
                roomId: newRoom[0].id,
                tenantId: input.tenantId,
                periodStartDate: periodStartDate,
                periodEndDate: periodEndDate,
                dueDate: dueDate,
                billingCycleDay: billingCycleDay,
                period: period,
                monthsCovered: 1,
                roomPrice: roomPrice.toString(),
                totalAmount: totalAmount.toString(),
                isPaid: false,
                generatedAt: new Date(),
            });
            
            console.log(`[Auto-Bill] Created first rent bill for room ${newRoom[0].name} (${periodStartDate} - ${periodEndDate})`);
        } catch (error) {
            console.error('[Auto-Bill] Failed to create first rent bill:', error);
            // Don't throw - room was created successfully, just log the bill creation failure
        }
    }

    return newRoom[0];
});
