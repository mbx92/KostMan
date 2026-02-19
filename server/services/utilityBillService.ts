import { db } from '../utils/drizzle';
import { utilityBills, rooms, properties } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Role } from '../utils/permissions';
import { createError } from 'h3';

// Type compatible with both db instance and transaction
type DbClient = NodePgDatabase<Record<string, never>>;

export interface UtilityBillInput {
    roomId: string;
    period: string;
    meterStart: number;
    meterEnd: number;
    costPerKwh: number;
    waterFee: number;
    trashFee: number;
    additionalCost?: number;
}

export interface UtilityBillUser {
    id: string;
    role: string;
}

/**
 * Verify that a room exists and return its data.
 * Throws 404 if the room is not found.
 */
export async function verifyRoomExists(roomId: string, tx?: DbClient) {
    const client = tx || db;
    const room = await client.select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

    if (room.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Room not found' });
    }

    return room[0];
}

/**
 * Verify that the user has ownership access to the room's property.
 * Admins bypass this check. Throws 403 if the user is not the property owner.
 */
export async function verifyRoomOwnership(roomData: { propertyId: string }, user: UtilityBillUser, tx?: DbClient) {
    if (user.role !== Role.ADMIN) {
        const client = tx || db;
        const property = await client.select()
            .from(properties)
            .where(eq(properties.id, roomData.propertyId))
            .limit(1);

        if (property.length === 0 || property[0].userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
        }
    }
}

/**
 * Calculate utility bill costs based on meter readings, fees, and occupant count.
 */
export function calculateUtilityBillCosts(input: UtilityBillInput, occupantCount: number) {
    const effectiveOccupantCount = occupantCount || 1;
    const usageCost = (input.meterEnd - input.meterStart) * input.costPerKwh;
    const adjustedWaterFee = input.waterFee * effectiveOccupantCount;
    const totalAmount = usageCost + adjustedWaterFee + input.trashFee + (input.additionalCost || 0);

    return {
        usageCost,
        adjustedWaterFee,
        totalAmount,
    };
}

/**
 * Create a utility bill record in the database.
 * This is the full orchestration: verify room, verify ownership, calculate costs, and insert.
 */
export async function createUtilityBill(input: UtilityBillInput, user: UtilityBillUser, tx?: DbClient) {
    const client = tx || db;

    // Verify room exists
    const roomData = await verifyRoomExists(input.roomId, client);

    // Ownership verification
    await verifyRoomOwnership(roomData, user, client);

    // Calculate costs
    const { usageCost, adjustedWaterFee, totalAmount } = calculateUtilityBillCosts(input, roomData.occupantCount || 1);

    // Insert utility bill
    const newBill = await client.insert(utilityBills).values({
        roomId: input.roomId,
        tenantId: roomData.tenantId || null,
        period: input.period,
        meterStart: input.meterStart,
        meterEnd: input.meterEnd,
        costPerKwh: input.costPerKwh.toString(),
        usageCost: usageCost.toString(),
        waterFee: adjustedWaterFee.toString(),
        trashFee: input.trashFee.toString(),
        additionalCost: (input.additionalCost || 0).toString(),
        totalAmount: totalAmount.toString(),
        isPaid: false,
        generatedAt: new Date(),
    }).returning();

    return newBill[0];
}

/**
 * Get a utility bill by ID.
 * Throws 404 if not found.
 */
export async function getUtilityBillById(id: string, tx?: DbClient) {
    const client = tx || db;
    const existing = await client.select()
        .from(utilityBills)
        .where(eq(utilityBills.id, id))
        .limit(1);

    if (!existing.length) {
        throw createError({ statusCode: 404, statusMessage: 'Utility bill not found' });
    }

    return existing[0];
}

/**
 * Verify that the user has ownership access to a utility bill (via room → property).
 * Admins bypass this check. Throws 403 if the user is not the property owner.
 */
export async function verifyBillOwnership(bill: { roomId: string }, user: UtilityBillUser, tx?: DbClient) {
    if (user.role !== Role.ADMIN) {
        const client = tx || db;
        const room = await client.select()
            .from(rooms)
            .where(eq(rooms.id, bill.roomId))
            .limit(1);

        if (room.length > 0) {
            const property = await client.select()
                .from(properties)
                .where(eq(properties.id, room[0].propertyId))
                .limit(1);

            if (property.length === 0 || property[0].userId !== user.id) {
                throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
            }
        }
    }
}

/**
 * Mark a utility bill as paid.
 * Throws 400 if the bill is already paid.
 */
export async function updateUtilityBillPaid(id: string, tx?: DbClient) {
    const client = tx || db;
    const bill = await getUtilityBillById(id, client);

    if (bill.isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Bill is already paid' });
    }

    const result = await client.update(utilityBills).set({
        isPaid: true,
        paidAt: new Date(),
    }).where(eq(utilityBills.id, id)).returning();

    return result[0];
}

/**
 * Delete a utility bill.
 * Performs ownership verification and prevents deleting paid bills.
 */
export async function deleteUtilityBill(id: string, user: UtilityBillUser, tx?: DbClient) {
    const client = tx || db;
    const bill = await getUtilityBillById(id, client);

    // Ownership verification
    await verifyBillOwnership(bill, user, client);

    if (bill.isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Cannot delete a paid bill' });
    }

    await client.delete(utilityBills).where(eq(utilityBills.id, id));

    return { message: 'Utility bill deleted successfully' };
}

/**
 * Find a utility bill by roomId and period.
 * Returns the bill or null if not found.
 */
export async function findUtilityBillByRoomAndPeriod(roomId: string, period: string, tx?: DbClient) {
    const client = tx || db;
    const result = await client.select()
        .from(utilityBills)
        .where(and(
            eq(utilityBills.roomId, roomId),
            eq(utilityBills.period, period),
        ))
        .limit(1);

    return result.length > 0 ? result[0] : null;
}

/**
 * Update an existing utility bill with new meter readings and recalculated costs.
 * Throws 400 if the bill is already paid.
 */
export async function updateUtilityBill(id: string, input: UtilityBillInput, user: UtilityBillUser, tx?: DbClient) {
    const client = tx || db;
    const bill = await getUtilityBillById(id, client);

    if (bill.isPaid) {
        throw createError({ statusCode: 400, statusMessage: 'Cannot update a paid bill' });
    }

    // Verify room exists and get occupant count
    const roomData = await verifyRoomExists(input.roomId, client);

    // Ownership verification
    await verifyRoomOwnership(roomData, user, client);

    // Recalculate costs
    const { usageCost, adjustedWaterFee, totalAmount } = calculateUtilityBillCosts(input, roomData.occupantCount || 1);

    const result = await client.update(utilityBills).set({
        meterStart: input.meterStart,
        meterEnd: input.meterEnd,
        costPerKwh: input.costPerKwh.toString(),
        usageCost: usageCost.toString(),
        waterFee: adjustedWaterFee.toString(),
        trashFee: input.trashFee.toString(),
        additionalCost: (input.additionalCost || 0).toString(),
        totalAmount: totalAmount.toString(),
    }).where(eq(utilityBills.id, id)).returning();

    return result[0];
}
