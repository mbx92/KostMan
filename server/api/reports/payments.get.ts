import { defineEventHandler, getQuery } from 'h3';
import { db } from '../../utils/drizzle';
import { rentBills, utilityBills, rooms, tenants, properties } from '../../database/schema';
import { eq, and, gte, lte, or, desc, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const startDate = query.startDate as string;
    const endDate = query.endDate as string;
    const propertyId = query.propertyId as string | undefined;
    const paymentMethod = query.paymentMethod as string | undefined;
    const billType = (query.billType as string) || 'all';

    if (!startDate || !endDate) {
        throw createError({
            statusCode: 400,
            message: 'Start date and end date are required'
        });
    }

    // Helper to build queries
    // We fetch Rent and Utility bills separately then merge

    // 1. Rent Bills Query
    let rentBillsQuery = db.select({
        id: rentBills.id,
        amount: rentBills.totalAmount,
        paidAt: rentBills.paidAt,
        paymentMethod: rentBills.paymentMethod,
        period: rentBills.period,
        roomName: rooms.name,
        tenantName: tenants.name,
        propertyId: rooms.propertyId,
        propertyName: properties.name
    })
        .from(rentBills)
        .innerJoin(rooms, eq(rentBills.roomId, rooms.id))
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
        .where(and(
            eq(rentBills.isPaid, true),
            gte(rentBills.paidAt, new Date(startDate)),
            lte(rentBills.paidAt, new Date(endDate + 'T23:59:59')), // Inclusive end date
            propertyId ? eq(rooms.propertyId, propertyId) : undefined,
            paymentMethod ? eq(rentBills.paymentMethod, paymentMethod as any) : undefined
        ));

    // 2. Utility Bills Query
    let utilityBillsQuery = db.select({
        id: utilityBills.id,
        amount: utilityBills.totalAmount,
        paidAt: utilityBills.paidAt,
        paymentMethod: utilityBills.paymentMethod,
        period: utilityBills.period,
        roomName: rooms.name,
        tenantName: tenants.name,
        propertyId: rooms.propertyId,
        propertyName: properties.name
    })
        .from(utilityBills)
        .innerJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
        .where(and(
            eq(utilityBills.isPaid, true),
            gte(utilityBills.paidAt, new Date(startDate)),
            lte(utilityBills.paidAt, new Date(endDate + 'T23:59:59')),
            propertyId ? eq(rooms.propertyId, propertyId) : undefined,
            paymentMethod ? eq(utilityBills.paymentMethod, paymentMethod as any) : undefined
        ));

    const [rentResults, utilityResults] = await Promise.all([
        (billType === 'all' || billType === 'rent') ? rentBillsQuery : [],
        (billType === 'all' || billType === 'utility') ? utilityBillsQuery : []
    ]);

    // Combine and normalize
    const allPayments = [
        ...rentResults.map(r => ({ ...r, billType: 'rent' as const })),
        ...utilityResults.map(u => ({ ...u, billType: 'utility' as const }))
    ].sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime());

    // --- Aggregations ---

    // Summary
    const totalAmount = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const rentPayments = allPayments.filter(p => p.billType === 'rent');
    const utilityPayments = allPayments.filter(p => p.billType === 'utility');

    // By Payment Method
    const byPaymentMethodMap = new Map<string, { count: number, amount: number }>();
    allPayments.forEach(p => {
        const method = p.paymentMethod || 'unknown';
        const current = byPaymentMethodMap.get(method) || { count: 0, amount: 0 };
        byPaymentMethodMap.set(method, {
            count: current.count + 1,
            amount: current.amount + Number(p.amount)
        });
    });

    const byPaymentMethod = Array.from(byPaymentMethodMap.entries()).map(([method, stats]) => ({
        method,
        count: stats.count,
        amount: stats.amount,
        percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    // By Property
    const byPropertyMap = new Map<string, { name: string, count: number, amount: number }>();
    allPayments.forEach(p => {
        const pid = p.propertyId;
        const current = byPropertyMap.get(pid) || { name: p.propertyName, count: 0, amount: 0 };
        byPropertyMap.set(pid, {
            name: p.propertyName,
            count: current.count + 1,
            amount: current.amount + Number(p.amount)
        });
    });

    const byProperty = Array.from(byPropertyMap.entries()).map(([id, stats]) => ({
        propertyId: id,
        propertyName: stats.name,
        paymentsCount: stats.count,
        totalAmount: stats.amount
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Daily Payments (Trend)
    const dailyMap = new Map<string, { count: number, amount: number }>();
    allPayments.forEach(p => {
        if (!p.paidAt) return;
        const date = new Date(p.paidAt).toISOString().split('T')[0];
        const current = dailyMap.get(date) || { count: 0, amount: 0 };
        dailyMap.set(date, {
            count: current.count + 1,
            amount: current.amount + Number(p.amount)
        });
    });

    // Fill in gaps? Maybe not strictly necessary for MVP, but nice for charts. 
    // We'll return just the data points for now.
    const dailyPayments = Array.from(dailyMap.entries())
        .map(([date, stats]) => ({
            date,
            count: stats.count,
            amount: stats.amount
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Formatted Payments List
    const paymentsList = allPayments.map(p => ({
        id: p.id,
        billType: p.billType,
        roomName: p.roomName,
        tenantName: p.tenantName || 'Unknown',
        amount: Number(p.amount),
        paidDate: p.paidAt ? new Date(p.paidAt).toISOString() : null,
        paymentMethod: p.paymentMethod || 'unknown',
        period: p.period
    }));

    return {
        summary: {
            totalPayments: allPayments.length,
            totalAmount,
            rentPaymentsCount: rentPayments.length,
            utilityPaymentsCount: utilityPayments.length,
            averagePaymentAmount: allPayments.length > 0 ? totalAmount / allPayments.length : 0
        },
        byPaymentMethod,
        byProperty,
        dailyPayments,
        payments: paymentsList
    };
});
