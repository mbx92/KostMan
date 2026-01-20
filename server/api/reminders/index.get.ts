
import { defineEventHandler } from 'h3';
import { db } from '../../utils/drizzle';
import { rentBills, utilityBills, tenants, rooms, properties } from '../../database/schema';
import { eq, and, lte, gt, desc, asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Fetch all unpaid bills (Rent & Utility)
    const unpaidRentBills = await db.select({
        id: rentBills.id,
        amount: rentBills.totalAmount,
        dueDate: rentBills.dueDate,
        createdAt: rentBills.generatedAt,
        tenantId: rentBills.tenantId,
        roomId: rentBills.roomId,
        // Rent specific
        period: rentBills.period,
        monthsCovered: rentBills.monthsCovered,
        roomPrice: rentBills.roomPrice,
        // Join details
        tenantName: tenants.name,
        tenantContact: tenants.contact,
        roomName: rooms.name,
        propertyName: properties.name,
        propertyId: properties.id,
        occupantCount: rooms.occupantCount
    })
        .from(rentBills)
        .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
        .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(rentBills.isPaid, false));

    const unpaidUtilityBills = await db.select({
        id: utilityBills.id,
        amount: utilityBills.totalAmount,
        dueDate: utilityBills.generatedAt, // Using generatedAt as proxy
        createdAt: utilityBills.generatedAt,
        tenantId: utilityBills.tenantId,
        roomId: utilityBills.roomId,
        // Utility specific
        period: utilityBills.period,
        meterStart: utilityBills.meterStart,
        meterEnd: utilityBills.meterEnd,
        usageCost: utilityBills.usageCost,
        waterFee: utilityBills.waterFee,
        trashFee: utilityBills.trashFee,
        // Join details
        tenantName: tenants.name,
        tenantContact: tenants.contact,
        roomName: rooms.name,
        propertyName: properties.name,
        propertyId: properties.id,
        occupantCount: rooms.occupantCount
    })
        .from(utilityBills)
        .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
        .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(utilityBills.isPaid, false));

    // 2. Normalize and Combine
    const today = new Date();

    const allBills = [
        ...unpaidRentBills.map(b => ({
            ...b,
            type: 'rent',
            dueDateObj: new Date(b.dueDate as string | Date)
        })),
        ...unpaidUtilityBills.map(b => {
            // Logic: Utility bill due 7 days after generation
            const d = new Date(b.createdAt as string | Date);
            d.setDate(d.getDate() + 7);
            return {
                ...b,
                type: 'utility',
                dueDateObj: d
            };
        })
    ];



    // 3. Categorize
    const overdue = [];
    const dueSoon = [];
    const upcoming = [];

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    for (const bill of allBills) {
        const dueDate = bill.dueDateObj;

        // Calculate days diff (negative means overdue)
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const formattedBill = {
            ...bill,
            dueDate: bill.dueDateObj.toISOString().split('T')[0], // Standardize to YYYY-MM-DD
            daysUntilDue: diffDays,
            isOverdue: diffDays < 0
        };

        if (diffDays < 0) {
            overdue.push(formattedBill);
        } else if (diffDays <= 3) {
            dueSoon.push(formattedBill);
        } else {
            upcoming.push(formattedBill);
        }
    }

    // 4. Sort (Most urgent first)
    const sortByDate = (a: any, b: any) => a.dueDateObj.getTime() - b.dueDateObj.getTime();

    overdue.sort(sortByDate);
    dueSoon.sort(sortByDate);
    upcoming.sort(sortByDate);

    return {
        overdue,
        dueSoon,
        upcoming,
        counts: {
            total: allBills.length,
            overdue: overdue.length,
            dueSoon: dueSoon.length
        }
    };
});
