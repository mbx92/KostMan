import { db } from './drizzle';
import { rooms, meterReadings, globalSettings, billings } from '../database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * Calculate the number of months covered by a billing period
 * @param periodStart - Start date (YYYY-MM-DD)
 * @param periodEnd - End date (YYYY-MM-DD)
 * @returns Number of months covered (decimal)
 */
export function calculateMonthsCovered(periodStart: string, periodEnd: string): number {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Calculate total days in period (inclusive)
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Get all months in the period
    const months: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
    }

    // Calculate total days in all months
    let totalDaysInMonths = 0;
    const uniqueMonths = new Set<string>();

    for (const month of months) {
        const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        if (!uniqueMonths.has(monthKey)) {
            uniqueMonths.add(monthKey);
            const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            totalDaysInMonths += daysInMonth;
        }
    }

    // Calculate average days per month
    const averageDaysPerMonth = totalDaysInMonths / uniqueMonths.size;

    // Calculate months covered
    const monthsCovered = totalDays / averageDaysPerMonth;

    return Math.round(monthsCovered * 100) / 100; // Round to 2 decimal places
}

/**
 * Generate unique billing code
 * @param periodStart - Start date (YYYY-MM-DD)
 * @returns Billing code (e.g., BILL-2026-01-001)
 */
export async function generateBillingCode(periodStart: string): Promise<string> {
    const date = new Date(periodStart);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Find the last billing code for this month using SQL LIKE
    const prefix = `BILL-${year}-${month}-`;

    // Use raw SQL to get max sequence number for this month
    const result = await db.execute(`
        SELECT billing_code 
        FROM billings 
        WHERE billing_code LIKE '${prefix}%'
        ORDER BY billing_code DESC 
        LIMIT 1
    `);

    let sequence = 1;
    if (result.rows && result.rows.length > 0) {
        const lastCode = (result.rows[0] as any).billing_code;
        const lastSequence = parseInt(lastCode.split('-').pop() || '0');
        sequence = lastSequence + 1;
    }

    // Add timestamp to make it more unique in case of race conditions
    const timestamp = Date.now().toString().slice(-3);
    const baseSequence = sequence;

    // Try up to 10 times to find a unique code
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = `${prefix}${String(baseSequence + attempt).padStart(3, '0')}`;

        // Check if this code already exists
        const existing = await db
            .select()
            .from(billings)
            .where(eq(billings.billingCode, code))
            .limit(1);

        if (existing.length === 0) {
            return code;
        }
    }

    // Fallback: use timestamp-based unique code
    return `${prefix}${timestamp}`;
}

/**
 * Calculate rent charges for a billing period
 * @param roomId - Room ID
 * @param monthsCovered - Number of months covered
 * @returns Rent charge details
 */
export async function calculateRentCharges(roomId: string, monthsCovered: number) {
    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (!room.length) {
        throw new Error('Room not found');
    }

    const roomPrice = parseFloat(room[0].price);
    const subtotal = roomPrice * monthsCovered;

    return {
        itemType: 'rent' as const,
        itemName: `Sewa Kamar${monthsCovered > 1 ? ` (${monthsCovered} bulan)` : ''}`,
        itemQty: monthsCovered,
        itemUnitPrice: roomPrice,
        itemSubAmount: subtotal,
        itemDiscount: 0,
        itemTotalAmount: subtotal,
    };
}

/**
 * Calculate utility charges based on meter readings within a period
 * @param roomId - Room ID
 * @param periodStart - Start date (YYYY-MM-DD)
 * @param periodEnd - End date (YYYY-MM-DD)
 * @returns Array of utility charge details
 */
export async function calculateUtilityCharges(
    roomId: string,
    periodStart: string,
    periodEnd: string
) {
    // Get meter readings within the period
    const readings = await db
        .select()
        .from(meterReadings)
        .where(
            and(
                eq(meterReadings.roomId, roomId),
                gte(meterReadings.period, periodStart.substring(0, 7)), // YYYY-MM
                lte(meterReadings.period, periodEnd.substring(0, 7))
            )
        )
        .orderBy(meterReadings.period);

    if (!readings.length) {
        return [];
    }

    // Get cost per kWh from settings
    const settings = await db.select().from(globalSettings).limit(1);
    const costPerKwh = settings.length ? parseFloat(settings[0].costPerKwh) : 1500;

    // Group by month and calculate charges
    const utilityDetails = [];

    for (const reading of readings) {
        const consumption = reading.meterEnd - reading.meterStart;
        const totalCost = consumption * costPerKwh;

        // Format period for display (e.g., "Januari 2026")
        const [year, month] = reading.period.split('-');
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const monthName = monthNames[parseInt(month) - 1];

        utilityDetails.push({
            itemType: 'utility' as const,
            itemName: `Listrik - ${monthName} ${year} (${consumption} kWh)`,
            itemQty: consumption,
            itemUnitPrice: costPerKwh,
            itemSubAmount: totalCost,
            itemDiscount: 0,
            itemTotalAmount: totalCost,
        });
    }

    return utilityDetails;
}

/**
 * Validate billing period for overlaps
 * @param roomId - Room ID
 * @param periodStart - Start date (YYYY-MM-DD)
 * @param periodEnd - End date (YYYY-MM-DD)
 * @param excludeBillId - Bill ID to exclude from check (for updates)
 * @returns True if valid, throws error if overlap found
 */
export async function validateBillingPeriod(
    roomId: string,
    periodStart: string,
    periodEnd: string,
    excludeBillId?: string
): Promise<boolean> {
    const query = db
        .select()
        .from(billings)
        .where(
            and(
                eq(billings.roomId, roomId),
                // Check for overlapping periods
                lte(billings.periodStart, periodEnd),
                gte(billings.periodEnd, periodStart)
            )
        );

    const overlappingBills = await query;

    // Filter out the excluded bill if provided
    const conflicts = excludeBillId
        ? overlappingBills.filter(bill => bill.id !== excludeBillId)
        : overlappingBills;

    if (conflicts.length > 0) {
        throw new Error(
            `Billing period overlaps with existing bill: ${conflicts[0].billingCode}`
        );
    }

    return true;
}

/**
 * Format currency for display
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * Parse decimal string to number
 * @param value - Decimal string
 * @returns Number value
 */
export function parseDecimal(value: string): number {
    return parseFloat(value) || 0;
}
