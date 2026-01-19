import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, rentBills, utilityBills, tenants, properties } from '../../database/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

/**
 * GET /api/reminders/due-soon
 * Returns rooms with unpaid bills:
 * 1. Due within 3 days (based on moveInDate)
 * 2. Any existing unpaid invoices (regardless of due date)
 */
export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const today = new Date();
    const currentDay = today.getDate();
    
    // Get all occupied rooms with tenant
    const occupiedRooms = await db.select({
        room: rooms,
        tenant: tenants,
        property: properties,
    })
        .from(rooms)
        .leftJoin(tenants, eq(rooms.tenantId, tenants.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(and(
            eq(rooms.status, 'occupied'),
            isNotNull(rooms.tenantId)
        ));

    const reminderItems = [];

    for (const { room, tenant, property } of occupiedRooms) {
        if (!tenant) continue;

        // Check for unpaid bills for this room
        const unpaidRentBills = await db.select()
            .from(rentBills)
            .where(and(
                eq(rentBills.roomId, room.id),
                eq(rentBills.isPaid, false)
            ));

        const unpaidUtilityBills = await db.select()
            .from(utilityBills)
            .where(and(
                eq(utilityBills.roomId, room.id),
                eq(utilityBills.isPaid, false)
            ));

        const totalUnpaidRent = unpaidRentBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        const totalUnpaidUtility = unpaidUtilityBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        const totalUnpaid = totalUnpaidRent + totalUnpaidUtility;

        // Skip if no unpaid bills
        if (totalUnpaid === 0) continue;

        // Calculate days until due (based on moveInDate)
        let dueDay: number | null = null;
        let daysUntilDue: number | null = null;
        let reminderType: 'due_soon' | 'overdue' | 'unpaid' = 'unpaid';

        if (room.moveInDate) {
            const moveInDate = new Date(room.moveInDate);
            dueDay = moveInDate.getDate();

            if (dueDay >= currentDay) {
                // Due date is this month, ahead of or today
                daysUntilDue = dueDay - currentDay;
            } else {
                // Due date has passed this month
                daysUntilDue = dueDay - currentDay; // Will be negative (overdue)
            }

            // Determine reminder type
            if (daysUntilDue < 0) {
                reminderType = 'overdue';
            } else if (daysUntilDue <= 3) {
                reminderType = 'due_soon';
            }
        }

        reminderItems.push({
            room: {
                id: room.id,
                name: room.name,
                price: room.price,
                moveInDate: room.moveInDate,
                occupantCount: room.occupantCount || 1,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                contact: tenant.contact,
            },
            property: property ? {
                id: property.id,
                name: property.name,
            } : null,
            dueDay,
            daysUntilDue,
            reminderType,
            dueDate: dueDay ? new Date(today.getFullYear(), today.getMonth(), dueDay).toISOString().split('T')[0] : null,
            unpaidRentBills: unpaidRentBills.length,
            unpaidUtilityBills: unpaidUtilityBills.length,
            totalUnpaidRent,
            totalUnpaidUtility,
            totalUnpaid,
        });
    }

    // Sort: overdue first, then due_soon, then unpaid. Within each group, sort by urgency
    reminderItems.sort((a, b) => {
        const typeOrder = { overdue: 0, due_soon: 1, unpaid: 2 };
        const orderA = typeOrder[a.reminderType];
        const orderB = typeOrder[b.reminderType];
        
        if (orderA !== orderB) return orderA - orderB;
        
        // Within same type, sort by days until due (most urgent first)
        if (a.daysUntilDue !== null && b.daysUntilDue !== null) {
            return a.daysUntilDue - b.daysUntilDue;
        }
        return 0;
    });

    return {
        count: reminderItems.length,
        dueSoonCount: reminderItems.filter(r => r.reminderType === 'due_soon').length,
        overdueCount: reminderItems.filter(r => r.reminderType === 'overdue').length,
        items: reminderItems,
    };
});
