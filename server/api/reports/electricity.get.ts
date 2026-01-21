import { defineEventHandler, getQuery } from 'h3';
import { db } from '../../utils/drizzle';
import { utilityBills, rooms, properties } from '../../database/schema';
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const startDateStr = query.startDate as string;
    const endDateStr = query.endDate as string;
    const propertyId = query.propertyId as string | undefined;

    if (!startDateStr || !endDateStr) {
        throw createError({
            statusCode: 400,
            message: 'Start date and end date are required'
        });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr + 'T23:59:59');

    // Fetch Utility Bills
    // We use generatedAt for date filtering as it represents when the bill/usage was processed
    const bills = await db.select({
        id: utilityBills.id,
        period: utilityBills.period,
        meterStart: utilityBills.meterStart,
        meterEnd: utilityBills.meterEnd,
        usageCost: utilityBills.usageCost,
        costPerKwh: utilityBills.costPerKwh,
        totalAmount: utilityBills.totalAmount,
        generatedAt: utilityBills.generatedAt,
        roomId: rooms.id,
        roomName: rooms.name,
        propertyId: properties.id,
        propertyName: properties.name
    })
        .from(utilityBills)
        .innerJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(and(
            gte(utilityBills.generatedAt, startDate),
            lte(utilityBills.generatedAt, endDate),
            propertyId ? eq(rooms.propertyId, propertyId) : undefined
        ))
        .orderBy(asc(utilityBills.generatedAt));

    if (bills.length === 0) {
        return {
            summary: {
                totalUsage: 0,
                totalCost: 0,
                averageUsagePerRoom: 0,
                averageCostPerRoom: 0,
                highestUsageRoom: null,
                lowestUsageRoom: null
            },
            byPeriod: [],
            byRoom: [],
            unusualUsage: []
        };
    }

    // Process Data
    const roomMap = new Map<string, any>();
    const periodMap = new Map<string, any>();

    let totalUsage = 0;
    let totalCost = 0;

    // Track aggregations
    // We need to calculate usage from meter readings if not explicitly stored (schema has meterStart, meterEnd)

    const processedBills = bills.map(bill => {
        const usage = bill.meterEnd - bill.meterStart; // kWh
        const cost = Number(bill.usageCost); // Use usageCost for pure electricity analysis, totalAmount might include water/trash

        totalUsage += usage;
        totalCost += cost;

        return { ...bill, usage, cost };
    });

    // By Period Aggregation
    processedBills.forEach(bill => {
        const period = bill.period; // YYYY-MM
        const current = periodMap.get(period) || { totalUsage: 0, totalCost: 0, roomsReported: 0 };
        current.totalUsage += bill.usage;
        current.totalCost += bill.cost;
        current.roomsReported += 1;
        periodMap.set(period, current);
    });

    const byPeriod = Array.from(periodMap.entries()).map(([period, stats]) => ({
        period,
        totalUsage: stats.totalUsage,
        totalCost: stats.totalCost,
        roomsReported: stats.roomsReported
    })).sort((a, b) => a.period.localeCompare(b.period));

    // By Room Aggregation
    processedBills.forEach(bill => {
        const rid = bill.roomId;
        const current = roomMap.get(rid) || {
            roomId: rid,
            roomName: bill.roomName,
            propertyName: bill.propertyName,
            readings: [],
            totalUsage: 0,
            totalCost: 0
        };

        current.totalUsage += bill.usage;
        current.totalCost += bill.cost;
        current.readings.push({
            period: bill.period,
            previousReading: bill.meterStart,
            currentReading: bill.meterEnd,
            usage: bill.usage,
            cost: bill.cost,
            pricePerKwh: Number(bill.costPerKwh),
            readingDate: bill.generatedAt // approx
        });

        roomMap.set(rid, current);
    });

    const byRoom = Array.from(roomMap.values()).map(r => ({
        ...r,
        averageUsage: r.totalUsage / r.readings.length,
        trend: 'stable' // Logic: compare last 2 readings if exist
    }));

    // Calculate Trends and Unusual Usage
    const unusualUsage: any[] = [];

    byRoom.forEach(room => {
        // Trend
        if (room.readings.length >= 2) {
            const sorted = room.readings.sort((a: any, b: any) => a.period.localeCompare(b.period));
            const last = sorted[sorted.length - 1];
            const prev = sorted[sorted.length - 2];
            if (last.usage > prev.usage * 1.1) room.trend = 'increasing';
            else if (last.usage < prev.usage * 0.9) room.trend = 'decreasing';
        }

        // Unusual Usage (> 20% deviation from room's average)
        room.readings.forEach((reading: any) => {
            if (room.averageUsage > 0) {
                const deviation = ((reading.usage - room.averageUsage) / room.averageUsage) * 100;
                if (Math.abs(deviation) > 20) {
                    unusualUsage.push({
                        roomId: room.roomId,
                        roomName: room.roomName,
                        period: reading.period,
                        usage: reading.usage,
                        averageUsage: room.averageUsage,
                        deviation
                    });
                }
            }
        });
    });

    // Summary Stats
    const uniqueRoomsCount = roomMap.size;
    const averageUsagePerRoom = uniqueRoomsCount > 0 ? totalUsage / uniqueRoomsCount : 0;
    const averageCostPerRoom = uniqueRoomsCount > 0 ? totalCost / uniqueRoomsCount : 0;

    const sortedByUsage = [...byRoom].sort((a, b) => b.totalUsage - a.totalUsage);
    const highestUsageRoom = sortedByUsage.length > 0 ? { roomName: sortedByUsage[0].roomName, usage: sortedByUsage[0].totalUsage } : null;
    const lowestUsageRoom = sortedByUsage.length > 0 ? { roomName: sortedByUsage[sortedByUsage.length - 1].roomName, usage: sortedByUsage[sortedByUsage.length - 1].totalUsage } : null;

    return {
        summary: {
            totalUsage,
            totalCost,
            averageUsagePerRoom,
            averageCostPerRoom,
            highestUsageRoom,
            lowestUsageRoom
        },
        byPeriod,
        byRoom: {
            data: byRoom // Return all rooms for client-side pagination
        },
        unusualUsage
    };
});
