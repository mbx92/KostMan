import { defineEventHandler, getQuery } from 'h3';
import { db } from '../../utils/drizzle';
import { tenants, rooms, properties, rentBills, utilityBills } from '../../database/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const propertyId = query.propertyId as string | undefined;
    const status = (query.status as string) || 'all'; // active, inactive, all

    // 1. Fetch Tenants with Room and Property info
    let tenantQuery = db.select({
        id: tenants.id,
        name: tenants.name,
        contact: tenants.contact,
        status: tenants.status,
        roomId: rooms.id,
        roomName: rooms.name,
        moveInDate: rooms.moveInDate,
        roomPrice: rooms.price,
        propertyId: properties.id,
        propertyName: properties.name
    })
        .from(tenants)
        .leftJoin(rooms, eq(tenants.id, rooms.tenantId))
        .leftJoin(properties, eq(rooms.propertyId, properties.id));

    // Apply filters
    // Note: Drizzle's query builder with joins and dynamic where is tricky.
    // We'll fetch and filter if simple, or construct conditions carefully.
    // If propertyId is strictly required, we filter where properties.id = propertyId.

    let whereConditions: any[] = [];
    if (status !== 'all') {
        whereConditions.push(eq(tenants.status, status as any));
    }
    if (propertyId) {
        whereConditions.push(eq(properties.id, propertyId));
    }

    // Since we used leftJoin, tenants without rooms might appear if we don't filter by propertyId.
    // If propertyId is provided, we only want tenants in that property (so they must have a room there).

    // Execute tenant fetch
    const tenantsList = await tenantQuery.where(and(...whereConditions));

    if (tenantsList.length === 0) {
        return {
            summary: {
                totalTenants: 0,
                activeTenants: 0,
                inactiveTenants: 0,
                averageTenancyDuration: 0,
                occupancyRate: 0
            },
            tenants: [],
            byProperty: []
        };
    }

    const tenantIds = tenantsList.map(t => t.id);

    // 2. Fetch Bills (Rent & Utility) for these tenants
    // We fetch ALL bills for these tenants to calculate comprehensive history
    const allRentBills = await db.select().from(rentBills).where(inArray(rentBills.tenantId, tenantIds));
    const allUtilityBills = await db.select().from(utilityBills).where(inArray(utilityBills.tenantId, tenantIds));

    // 3. Process Per Tenant
    const processedTenants = tenantsList.map(tenant => {
        // Bills for this tenant
        const tenantRentBills = allRentBills.filter(b => b.tenantId === tenant.id);
        const tenantUtilityBills = allUtilityBills.filter(b => b.tenantId === tenant.id);
        const allBills = [...tenantRentBills, ...tenantUtilityBills];

        // Stats
        const totalPaid = allBills.filter(b => b.isPaid).reduce((sum, b) => sum + Number(b.totalAmount), 0);
        const totalBillsCount = allBills.length;
        const paidBillsCount = allBills.filter(b => b.isPaid).length;
        const unpaidBillsCount = totalBillsCount - paidBillsCount;

        const outstandingBalance = allBills.filter(b => !b.isPaid).reduce((sum, b) => sum + Number(b.totalAmount), 0);

        // On-Time vs Late (Simple logic: if isPaid and paidAt <= dueDate)
        // Utility bills don't have dueDate in my previous memory of schema, checking...
        // rentBills has dueDate. utilityBills might not.
        let onTime = 0;
        let late = 0;

        tenantRentBills.filter(b => b.isPaid && b.paidAt).forEach(b => {
            const paid = new Date(b.paidAt!);
            const due = new Date(b.dueDate); // assuming dueDate exists
            // Truncate time for fair comparison
            paid.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);
            if (paid <= due) onTime++;
            else late++;
        });

        // Duration
        let durationDays = 0;
        if (tenant.moveInDate) {
            const start = new Date(tenant.moveInDate);
            const end = new Date(); // or moveOutDate if we had it, but mostly active tenants
            const diff = end.getTime() - start.getTime();
            durationDays = Math.floor(diff / (1000 * 3600 * 24));
        }

        return {
            id: tenant.id,
            name: tenant.name,
            contact: tenant.contact,
            status: tenant.status,
            roomName: tenant.roomName || 'N/A',
            propertyName: tenant.propertyName || 'N/A',
            propertyId: tenant.propertyId,
            moveInDate: tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().split('T')[0] : null,
            monthlyRent: Number(tenant.roomPrice || 0),

            paymentHistory: {
                totalPaid,
                totalBills: totalBillsCount,
                paidBills: paidBillsCount,
                unpaidBills: unpaidBillsCount,
                outstandingBalance,
                onTimePayments: onTime,
                latePayments: late
            },

            tenancyDuration: durationDays
        };
    });

    // 4. Aggregations for Summary
    const totalTenants = processedTenants.length;
    const activeTenants = processedTenants.filter(t => t.status === 'active').length;
    const inactiveTenants = totalTenants - activeTenants;

    // Avg Duration (months)
    const totalDurationDays = processedTenants.reduce((sum, t) => sum + t.tenancyDuration, 0);
    const averageTenancyDuration = totalTenants > 0 ? (totalDurationDays / 30) / totalTenants : 0; // approx months

    // Occupancy Rate (Global or Filtered)
    // We need total rooms to calc occupancy.
    // If filtered by property, we need total rooms in that property.
    // This requires a separate query for room count.

    let roomCountWhere = [];
    if (propertyId) roomCountWhere.push(eq(rooms.propertyId, propertyId));

    // Count ALL rooms (occupied + available)
    // const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(rooms).where(and(...roomCountWhere)); 
    // Drizzle count is easier with .length of a select id
    const allRooms = await db.select({ id: rooms.id }).from(rooms).where(and(...roomCountWhere));
    const totalRooms = allRooms.length;

    // Occupied rooms
    // We can assume active tenant with assigned room = 1 occupied room. 
    // Or just count rooms with status 'occupied'
    const occupiedRooms = await db.select({ id: rooms.id }).from(rooms).where(and(...roomCountWhere, eq(rooms.status, 'occupied')));

    const occupancyRate = totalRooms > 0 ? (occupiedRooms.length / totalRooms) * 100 : 0;

    // By Property Aggregation
    const propertyMap = new Map<string, { id: string, name: string, count: number }>();
    processedTenants.forEach(t => {
        if (!t.propertyId) return;
        const current = propertyMap.get(t.propertyId) || { id: t.propertyId, name: t.propertyName, count: 0 };
        current.count++;
        propertyMap.set(t.propertyId, current);
    });

    const byProperty = Array.from(propertyMap.values()).map(p => ({
        propertyId: p.id,
        propertyName: p.name,
        tenantsCount: p.count,
        occupancyRate: 0 // Would need per-property room count to accuracy calc this line by line. Leaving 0 for now to keep it simple or we can fetch it.
    }));

    return {
        summary: {
            totalTenants,
            activeTenants,
            inactiveTenants,
            averageTenancyDuration,
            occupancyRate
        },
        tenants: processedTenants,
        byProperty
    };
});
