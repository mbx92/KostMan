import { defineEventHandler, getQuery } from 'h3';
import { db } from '../../utils/drizzle';
import { rentBills, utilityBills, expenses, properties, expenseCategories, rooms } from '../../database/schema';
import { eq, and, gte, lte, or, desc, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const startDateStr = query.startDate as string;
    const endDateStr = query.endDate as string;
    const propertyId = query.propertyId as string | undefined;
    const groupBy = (query.groupBy as 'month' | 'year') || 'month';

    if (!startDateStr || !endDateStr) {
        throw createError({
            statusCode: 400,
            message: 'Start date and end date are required'
        });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr + 'T23:59:59');

    // 1. Fetch Revenue (Paid Bills)
    // Rent
    const rentQuery = db.select({
        amount: rentBills.totalAmount,
        date: rentBills.paidAt,
        propertyId: rooms.propertyId
    })
        .from(rentBills)
        .innerJoin(rooms, eq(rentBills.roomId, rooms.id))
        .where(and(
            eq(rentBills.isPaid, true),
            gte(rentBills.paidAt, startDate),
            lte(rentBills.paidAt, endDate),
            propertyId ? eq(rooms.propertyId, propertyId) : undefined
        ));

    // Utility
    const utilityQuery = db.select({
        amount: utilityBills.totalAmount,
        date: utilityBills.paidAt,
        propertyId: rooms.propertyId
    })
        .from(utilityBills)
        .innerJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .where(and(
            eq(utilityBills.isPaid, true),
            gte(utilityBills.paidAt, startDate),
            lte(utilityBills.paidAt, endDate),
            propertyId ? eq(rooms.propertyId, propertyId) : undefined
        ));

    // 2. Fetch Expenses (Paid)
    // We assume Cash Basis P&L, so we filter by paidDate
    // Also join with expenseCategories for breakdown
    const expenseQuery = db.select({
        amount: expenses.amount,
        date: expenses.paidDate, // Using paidDate for Cash Basis
        categoryName: expenses.category,
        propertyId: expenses.propertyId
    })
        .from(expenses)
        // .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id)) // expenses schema uses 'category' string
        .where(and(
            gte(expenses.paidDate, startDateStr), // expenses.paidDate is date/string usually? Schema check: expenseDate is string YYYY-MM-DD? check previous turns. paidDate is string in schema?
            lte(expenses.paidDate, endDateStr),
            propertyId ? eq(expenses.propertyId, propertyId) : undefined
        ));

    // Schema check: paidDate in schema is valid?
    // In schema.ts, expenses table has expenseDate (date), paidDate (date). Drizzle date is usually string YYYY-MM-DD or Date object depending on driver.
    // In previous `server/validations/expense.ts`, paidDate is regex YYYY-MM-DD.
    // So standardized to YYYY-MM-DD string is likely safely sortable.

    const [rentResults, utilityResults, expenseResults] = await Promise.all([rentQuery, utilityQuery, expenseQuery]);

    // 3. Aggregate Data
    let totalRevenue = 0;
    let totalRentRevenue = 0;
    let totalUtilityRevenue = 0;
    let totalExpenses = 0;

    // Breakdowns
    const revenueBreakdown = { rentIncome: 0, utilityIncome: 0, otherIncome: 0 };
    const expenseCategoryMap = new Map<string, number>();

    const periodMap = new Map<string, { revenue: number, expenses: number }>();

    // Helper to add to period
    const addToPeriod = (dateStr: string | Date | null, amount: number, type: 'revenue' | 'expense') => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        let key = '';
        if (groupBy === 'year') {
            key = String(d.getFullYear());
        } else {
            key = d.toISOString().substring(0, 7); // YYYY-MM
        }

        const current = periodMap.get(key) || { revenue: 0, expenses: 0 };
        if (type === 'revenue') current.revenue += amount;
        else current.expenses += amount;
        periodMap.set(key, current);
    };

    // Process Rent
    rentResults.forEach(r => {
        const amt = Number(r.amount);
        totalRevenue += amt;
        totalRentRevenue += amt;
        addToPeriod(r.date, amt, 'revenue');
    });

    // Process Utility
    utilityResults.forEach(u => {
        const amt = Number(u.amount);
        totalRevenue += amt;
        totalUtilityRevenue += amt;
        addToPeriod(u.date, amt, 'revenue');
    });

    // Process Expenses
    expenseResults.forEach(e => {
        const amt = Number(e.amount);
        totalExpenses += amt;
        addToPeriod(e.date, amt, 'expense');

        const cat = e.categoryName || 'Uncategorized';
        expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + amt);
    });

    revenueBreakdown.rentIncome = totalRentRevenue;
    revenueBreakdown.utilityIncome = totalUtilityRevenue;

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Format Expense Breakdown
    const expenseBreakdown = Array.from(expenseCategoryMap.entries()).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);

    // Format By Period
    const byPeriod = Array.from(periodMap.entries()).map(([period, stats]) => {
        const pProfit = stats.revenue - stats.expenses;
        return {
            period,
            revenue: stats.revenue,
            expenses: stats.expenses,
            profit: pProfit,
            profitMargin: stats.revenue > 0 ? (pProfit / stats.revenue) * 100 : 0
        };
    }).sort((a, b) => a.period.localeCompare(b.period));

    // Cash Flow (Simple Summary)
    const cashFlow = {
        openingBalance: 0, // Not tracking wallet balance yet
        totalInflow: totalRevenue,
        totalOutflow: totalExpenses,
        closingBalance: totalRevenue - totalExpenses // Net change
    };

    // Property Breakdown (if no propertyId filtered)
    // We'd need to map property names. For now, we can skip complex byProperty unless requested, 
    // but report spec says "byProperty".
    // I need property names for results.
    // Ideally I'd fetch everything joined with property info.
    // Rent/Utility/Expense queries have 'propertyId'.
    // I can aggregate by propertyId.

    // Let's implement simplified ByProperty
    const propertyMap = new Map<string, { revenue: number, expenses: number }>();

    // I need property names. I'll fetch properties map lightly.
    const allProperties = await db.select({ id: properties.id, name: properties.name }).from(properties);
    const propNameMap = new Map(allProperties.map(p => [p.id, p.name]));

    const addToProperty = (pid: string | null, amount: number, type: 'revenue' | 'expense') => {
        if (!pid) return;
        const current = propertyMap.get(pid) || { revenue: 0, expenses: 0 };
        if (type === 'revenue') current.revenue += amount;
        else current.expenses += amount;
        propertyMap.set(pid, current);
    };

    rentResults.forEach(r => addToProperty(r.propertyId, Number(r.amount), 'revenue'));
    utilityResults.forEach(u => addToProperty(u.propertyId, Number(u.amount), 'revenue'));
    expenseResults.forEach(e => addToProperty(e.propertyId, Number(e.amount), 'expense'));

    const byProperty = Array.from(propertyMap.entries()).map(([pid, stats]) => {
        const pProfit = stats.revenue - stats.expenses;
        return {
            propertyId: pid,
            propertyName: propNameMap.get(pid) || 'Unknown',
            revenue: stats.revenue,
            expenses: stats.expenses,
            profit: pProfit,
            profitMargin: stats.revenue > 0 ? (pProfit / stats.revenue) * 100 : 0
        };
    });

    return {
        summary: {
            totalRevenue,
            totalExpenses,
            netProfit,
            profitMargin,
            revenueBreakdown,
            expenseBreakdown
        },
        byPeriod,
        byProperty,
        cashFlow
    };
});
