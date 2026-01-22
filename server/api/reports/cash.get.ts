import { defineEventHandler, getQuery } from 'h3';
import { db } from '../../utils/drizzle';
import { rooms, rentBills, utilityBills, properties } from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const month = query.month as string; // YYYY-MM
    const propertyId = query.propertyId as string | undefined;

    if (!month) {
        throw createError({
            statusCode: 400,
            message: 'Month is required (YYYY-MM)'
        });
    }

    // 1. Get Property Info if provided
    let propertyName = 'All Properties';
    if (propertyId) {
        const property = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
        if (property.length > 0) {
            propertyName = property[0].name;
        }
    }

    // 2. Get Occupied Rooms for Expected Calculation
    // We assume expected cash is based on currently occupied rooms
    const occupiedArgs = [eq(rooms.status, 'occupied')];
    if (propertyId) occupiedArgs.push(eq(rooms.propertyId, propertyId));

    // Note: This snapshot of occupied rooms might not perfectly reflect historical months,
    // but it's the specific logic requested: "All occupied rooms' rent"
    const occupiedRoomsList = await db.select({
        id: rooms.id,
        name: rooms.name,
        price: rooms.price,
        propertyId: rooms.propertyId
    })
        .from(rooms)
        .where(and(...occupiedArgs));

    // Calculate Expected
    // Since we don't have exact expected utilities without bills, 
    // we'll sum up the fixed rent prices. 
    // Ideally we would look at property settings for fixed fees, but for now let's use base rent.
    const expectedBreakdown = occupiedRoomsList.map(room => ({
        roomId: room.id,
        roomName: room.name,
        rentAmount: Number(room.price),
        estimatedUtility: 0 // Placeholder as per logic discussion
    }));

    const totalExpectedRent = expectedBreakdown.reduce((sum, item) => sum + item.rentAmount, 0);
    const totalExpectedUtilities = 0; // Can be enhanced with property settings later

    // 3. Get Real Cash (Paid Bills) for the month

    /* 
       Optimized Query Strategy:
        Fetch valid bills for the period.
        Join with Rooms to filter by PropertyId if needed.
    */

    const rentBillsQuery = db.select({
        bill: rentBills,
        roomName: rooms.name,
        roomPropertyId: rooms.propertyId
    })
        .from(rentBills)
        .innerJoin(rooms, eq(rentBills.roomId, rooms.id))
        .where(and(
            eq(rentBills.period, month),
            propertyId ? eq(rooms.propertyId, propertyId) : undefined
        ));

    const fetchedRentBills = await rentBillsQuery;

    const utilityBillsQuery = db.select({
        bill: utilityBills,
        roomName: rooms.name,
        roomPropertyId: rooms.propertyId
    })
        .from(utilityBills)
        .innerJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .where(and(
            eq(utilityBills.period, month),
            propertyId ? eq(rooms.propertyId, propertyId) : undefined
        ));

    const fetchedUtilityBills = await utilityBillsQuery;

    // Process Real Cash
    const paidRentBills = fetchedRentBills.filter(r => r.bill.isPaid);
    const paidUtilityBills = fetchedUtilityBills.filter(u => u.bill.isPaid);

    const paidBillsBreakdown = [
        ...paidRentBills.map(item => ({
            roomId: item.bill.roomId,
            roomName: item.roomName,
            rentPaid: Number(item.bill.totalAmount),
            utilityPaid: 0,
            paidDate: item.bill.paidAt ? new Date(item.bill.paidAt).toISOString() : null,
            type: 'rent'
        })),
        ...paidUtilityBills.map(item => ({
            roomId: item.bill.roomId,
            roomName: item.roomName,
            rentPaid: 0,
            utilityPaid: Number(item.bill.totalAmount),
            paidDate: item.bill.paidAt ? new Date(item.bill.paidAt).toISOString() : null,
            type: 'utility'
        }))
    ];

    // Group by room for cleaner output
    const realCashByRoom: Record<string, any> = {};
    paidBillsBreakdown.forEach(bill => {
        if (!realCashByRoom[bill.roomId]) {
            realCashByRoom[bill.roomId] = {
                roomId: bill.roomId,
                roomName: bill.roomName,
                rentPaid: 0,
                utilityPaid: 0,
                paidDate: bill.paidDate // Just take one
            };
        }
        realCashByRoom[bill.roomId].rentPaid += bill.rentPaid;
        realCashByRoom[bill.roomId].utilityPaid += bill.utilityPaid;
    });

    const realCashList = Object.values(realCashByRoom);

    const totalRentPaid = paidRentBills.reduce((sum, item) => sum + Number(item.bill.totalAmount), 0);
    const totalUtilitiesPaid = paidUtilityBills.reduce((sum, item) => sum + Number(item.bill.totalAmount), 0);
    const totalReal = totalRentPaid + totalUtilitiesPaid;

    // 4. Unpaid Bills (Bills generated but not paid)
    const unpaidRentBills = fetchedRentBills.filter(r => !r.bill.isPaid);
    const unpaidUtilityBills = fetchedUtilityBills.filter(u => !u.bill.isPaid);

    const unpaidBillsList = [
        ...unpaidRentBills.map(item => ({
            roomId: item.bill.roomId,
            roomName: item.roomName,
            tenantName: 'Unknown', // Need tenant join if we want names
            rentAmount: Number(item.bill.totalAmount),
            utilityAmount: 0,
            totalDue: Number(item.bill.totalAmount),
            dueDate: item.bill.dueDate
        })),
        ...unpaidUtilityBills.map(item => ({
            roomId: item.bill.roomId,
            roomName: item.roomName,
            tenantName: 'Unknown',
            rentAmount: 0,
            utilityAmount: Number(item.bill.totalAmount),
            totalDue: Number(item.bill.totalAmount),
            dueDate: null // Utility bills might not have due date in schema? checked schema: RentBills has dueDate, UtilityBills doesn't seem to have explicit dueDate in schema shown, maybe generatedAt?
        }))
    ];

    // 5. Calculate Variance
    // Expected Total vs Real Total
    // NOTE: If we use "Occupied Rooms" for expected, and it produces a number X.
    // And we have Bills Y.
    // Real is Z (Paid Bills).
    // Variance = Real - Expected.

    const varianceAmount = totalReal - (totalExpectedRent + totalExpectedUtilities);
    const variancePercentage = (totalExpectedRent + totalExpectedUtilities) > 0
        ? (varianceAmount / (totalExpectedRent + totalExpectedUtilities)) * 100
        : 0;

    return {
        month,
        propertyId,
        propertyName,
        expectedCash: {
            totalRent: totalExpectedRent,
            totalUtilities: totalExpectedUtilities,
            total: totalExpectedRent + totalExpectedUtilities,
            roomsCount: occupiedRoomsList.length,
            occupiedRooms: expectedBreakdown
        },
        realCash: {
            totalRentPaid,
            totalUtilitiesPaid,
            total: totalReal,
            paidRoomsCount: Object.keys(realCashByRoom).length,
            paidBills: realCashList
        },
        variance: {
            amount: varianceAmount,
            percentage: variancePercentage.toFixed(2)
        },
        unpaidBills: unpaidBillsList
    };
});
