import { defineEventHandler, getQuery } from 'h3';
import { db } from '../../utils/drizzle';
import { rentBills, utilityBills, rooms, properties } from '../../database/schema';
import { eq, and, gte, lte, or, desc, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const startDateStr = query.startDate as string;
    const endDateStr = query.endDate as string;
    const propertyId = query.propertyId as string | undefined;
    const groupBy = (query.groupBy as 'day' | 'week' | 'month') || 'month';

    if (!startDateStr || !endDateStr) {
        throw createError({
            statusCode: 400,
            message: 'Start date and end date are required'
        });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr + 'T23:59:59');

    // Helper to fetch data for a specific range
    const fetchIncomeData = async (start: Date, end: Date) => {
        const rentQuery = db.select({
            amount: rentBills.totalAmount,
            paidAt: rentBills.paidAt,
            roomId: rentBills.roomId,
            roomName: rooms.name,
            propertyId: rooms.propertyId,
            propertyName: properties.name
        })
            .from(rentBills)
            .innerJoin(rooms, eq(rentBills.roomId, rooms.id))
            .innerJoin(properties, eq(rooms.propertyId, properties.id))
            .where(and(
                eq(rentBills.isPaid, true),
                gte(rentBills.paidAt, start),
                lte(rentBills.paidAt, end),
                propertyId ? eq(rooms.propertyId, propertyId) : undefined
            ));

        const utilityQuery = db.select({
            amount: utilityBills.totalAmount,
            paidAt: utilityBills.paidAt,
            roomId: utilityBills.roomId,
            roomName: rooms.name,
            propertyId: rooms.propertyId,
            propertyName: properties.name
        })
            .from(utilityBills)
            .innerJoin(rooms, eq(utilityBills.roomId, rooms.id))
            .innerJoin(properties, eq(rooms.propertyId, properties.id))
            .where(and(
                eq(utilityBills.isPaid, true),
                gte(utilityBills.paidAt, start),
                lte(utilityBills.paidAt, end),
                propertyId ? eq(rooms.propertyId, propertyId) : undefined
            ));

        const [rentResults, utilityResults] = await Promise.all([rentQuery, utilityQuery]);

        return {
            rent: rentResults,
            utility: utilityResults,
            total: [...rentResults, ...utilityResults]
        };
    };

    // 1. Fetch Current Period Data
    const currentData = await fetchIncomeData(startDate, endDate);

    // 2. Fetch Previous Period Data for Growth Rate
    const duration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - duration);

    // We only need totals for previous period
    const prevData = await fetchIncomeData(prevStartDate, prevEndDate);
    const prevTotalIncome = prevData.total.reduce((sum, item) => sum + Number(item.amount), 0);

    // 3. Process Aggregations
    const totalRentIncome = currentData.rent.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalUtilityIncome = currentData.utility.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalIncome = totalRentIncome + totalUtilityIncome;

    // Growth Rate
    let growthRate = 0;
    if (prevTotalIncome > 0) {
        growthRate = ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100;
    } else if (totalIncome > 0) {
        growthRate = 100; // 100% growth if started from 0
    }

    // Average Monthly Income (simple approximation for range > 1 month? Or average of periods?)
    // If grouped by month, average of those months.
    // Let's reuse the 'byPeriod' calculation for this.

    // Grouping
    const periodMap = new Map<string, { rent: number, utility: number, total: number }>();

    const addToPeriod = (date: Date, amount: number, type: 'rent' | 'utility') => {
        let key = '';
        if (groupBy === 'day') {
            key = date.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
            // Simple approach: Start of week date
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(d.setDate(diff));
            key = monday.toISOString().split('T')[0]; // "Week of YYYY-MM-DD"
        } else {
            // Month
            key = date.toISOString().substring(0, 7); // YYYY-MM
        }

        const current = periodMap.get(key) || { rent: 0, utility: 0, total: 0 };
        if (type === 'rent') current.rent += amount;
        else current.utility += amount;
        current.total += amount;
        periodMap.set(key, current);
    };

    currentData.rent.forEach(item => addToPeriod(new Date(item.paidAt!), Number(item.amount), 'rent'));
    currentData.utility.forEach(item => addToPeriod(new Date(item.paidAt!), Number(item.amount), 'utility'));

    const byPeriod = Array.from(periodMap.entries()).map(([period, stats]) => ({
        period,
        rentIncome: stats.rent,
        utilityIncome: stats.utility,
        total: stats.total
    })).sort((a, b) => a.period.localeCompare(b.period));

    const averageMonthlyIncome = byPeriod.length > 0
        ? totalIncome / byPeriod.length // This is average per PERIOD (which might be days/weeks) not strictly months if grouped differently.
        : 0;
    // If user asked specifically for "averageMonthlyIncome" but grouped by day... terminology shift.
    // Let's assume average per period displayed.

    // By Property
    const propertyMap = new Map<string, { name: string, rent: number, utility: number, total: number }>();
    const processProperty = (item: any, type: 'rent' | 'utility') => {
        const pid = item.propertyId;
        const current = propertyMap.get(pid) || { name: item.propertyName, rent: 0, utility: 0, total: 0 };
        if (type === 'rent') current.rent += Number(item.amount);
        else current.utility += Number(item.amount);
        current.total += Number(item.amount);
        propertyMap.set(pid, current);
    };

    currentData.rent.forEach(i => processProperty(i, 'rent'));
    currentData.utility.forEach(i => processProperty(i, 'utility'));

    const byProperty = Array.from(propertyMap.entries()).map(([id, stats]) => ({
        propertyId: id,
        propertyName: stats.name,
        totalIncome: stats.total,
        rentIncome: stats.rent,
        utilityIncome: stats.utility,
        occupancyRate: 0, // Need separate room query to calc real occupancy. Placeholder for now.
        averageRentPerRoom: 0 // Placeholder
    })).sort((a, b) => b.totalIncome - a.totalIncome);

    // Top Performing Rooms
    const roomMap = new Map<string, { name: string, propertyName: string, total: number, count: number }>();
    const processRoom = (item: any) => {
        const rid = item.roomId;
        const current = roomMap.get(rid) || { name: item.roomName, propertyName: item.propertyName, total: 0, count: 0 };
        current.total += Number(item.amount);
        current.count += 1;
        roomMap.set(rid, current);
    };

    currentData.total.forEach(processRoom);

    const topPerformingRooms = Array.from(roomMap.entries())
        .map(([id, stats]) => ({
            roomId: id,
            roomName: stats.name,
            propertyName: stats.propertyName,
            totalPaid: stats.total,
            paymentsCount: stats.count
        }))
        .sort((a, b) => b.totalPaid - a.totalPaid)
        .slice(0, 5); // Top 5

    return {
        summary: {
            totalIncome,
            rentIncome: totalRentIncome,
            utilityIncome: totalUtilityIncome,
            otherIncome: 0,
            averageMonthlyIncome, // actually average per period
            growthRate
        },
        byPeriod,
        byProperty,
        topPerformingRooms
    };
});
