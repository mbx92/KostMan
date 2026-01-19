import { db } from '../../utils/drizzle';
import { rentBills, utilityBills, rooms, properties } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Get tenant from session
    const authHeader = getHeader(event, 'authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        });
    }

    const token = authHeader.substring(7);
    let session: any;
    
    try {
        session = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (e) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid token',
        });
    }

    const tenantId = session.tenantId;

    // Get all rent bills for this tenant
    const rentBillsData = await db.select({
        id: rentBills.id,
        roomId: rentBills.roomId,
        periodStartDate: rentBills.periodStartDate,
        periodEndDate: rentBills.periodEndDate,
        dueDate: rentBills.dueDate,
        period: rentBills.period,
        monthsCovered: rentBills.monthsCovered,
        roomPrice: rentBills.roomPrice,
        totalAmount: rentBills.totalAmount,
        isPaid: rentBills.isPaid,
        generatedAt: rentBills.generatedAt,
        paidAt: rentBills.paidAt,
        room: {
            id: rooms.id,
            name: rooms.name,
            propertyId: rooms.propertyId,
        },
        property: {
            id: properties.id,
            name: properties.name,
            address: properties.address,
        },
    })
    .from(rentBills)
    .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(eq(rentBills.tenantId, tenantId))
    .orderBy(desc(rentBills.periodStartDate));

    // Get all utility bills for this tenant
    const utilityBillsData = await db.select({
        id: utilityBills.id,
        roomId: utilityBills.roomId,
        period: utilityBills.period,
        meterStart: utilityBills.meterStart,
        meterEnd: utilityBills.meterEnd,
        usageCost: utilityBills.usageCost,
        waterFee: utilityBills.waterFee,
        trashFee: utilityBills.trashFee,
        totalAmount: utilityBills.totalAmount,
        isPaid: utilityBills.isPaid,
        generatedAt: utilityBills.generatedAt,
        paidAt: utilityBills.paidAt,
        room: {
            id: rooms.id,
            name: rooms.name,
            propertyId: rooms.propertyId,
        },
        property: {
            id: properties.id,
            name: properties.name,
            address: properties.address,
        },
    })
    .from(utilityBills)
    .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(eq(utilityBills.tenantId, tenantId))
    .orderBy(desc(utilityBills.period));

    return {
        success: true,
        rentBills: rentBillsData,
        utilityBills: utilityBillsData,
    };
});
