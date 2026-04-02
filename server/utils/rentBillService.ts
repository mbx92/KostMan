import { db } from './drizzle'
import { rentBills, rooms } from '../database/schema'
import { eq } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'

type DbClient = NodePgDatabase<Record<string, never>>

/**
 * Auto-generate a rent bill for the billing cycle that corresponds to the given meter period (YYYY-MM).
 *
 * Logic:
 *  1. Look up the room (moveInDate → billingCycleDay)
 *  2. Compute periodStartDate = YYYY-MM-{billingCycleDay} (clamped to month length)
 *  3. Compute periodEndDate   = periodStartDate + 1 month
 *  4. If any existing rent bill overlaps → skip (idempotent)
 *  5. Otherwise insert the rent bill (waterFee & trashFee handled by utility bills)
 *
 * Returns the new rent bill, or null if already exists / prerequisites missing.
 */
export async function autoGenerateRentBill(
    roomId: string,
    meterPeriod: string, // YYYY-MM
    tx?: DbClient,
) {
    const client = tx ?? db

    // 1. Fetch room
    const roomRows = await (client as any).select().from(rooms).where(eq(rooms.id, roomId)).limit(1)
    if (!roomRows.length) return null

    const room = roomRows[0]

    // Room must have a tenant to generate rent bill
    if (!room.tenantId) return null

    // 2. Determine billing cycle day from moveInDate (default: 1)
    let cycleDay = 1
    if (room.moveInDate) {
        const [, , d] = room.moveInDate.split('-').map(Number)
        cycleDay = d
    }

    // Parse meter period
    const [yearStr, monthStr] = meterPeriod.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr) // 1-12

    // Clamp cycleDay to max days in this month
    const maxDay = new Date(year, month, 0).getDate()
    if (cycleDay > maxDay) cycleDay = maxDay

    const periodStartDate = `${yearStr}-${monthStr}-${String(cycleDay).padStart(2, '0')}`

    // 3. periodEndDate = start + 1 month
    const startObj = new Date(`${periodStartDate}T00:00:00`)
    const endObj = new Date(startObj)
    endObj.setMonth(endObj.getMonth() + 1)
    const periodEndDate = endObj.toISOString().split('T')[0]

    // 4. Check overlap with existing rent bills
    const existing = await (client as any).select({
        periodStartDate: rentBills.periodStartDate,
        periodEndDate: rentBills.periodEndDate,
    }).from(rentBills).where(eq(rentBills.roomId, roomId))

    const s1 = new Date(periodStartDate).getTime()
    const e1 = new Date(periodEndDate).getTime()

    const hasOverlap = existing.some((b: any) => {
        const s2 = new Date(b.periodStartDate).getTime()
        const e2 = new Date(b.periodEndDate).getTime()
        return s1 <= e2 && e1 >= s2
    })

    if (hasOverlap) return null

    // 5. Calculate totals (waterFee & trashFee now handled by utility bills)
    const roomPrice = Number(room.price)
    const totalAmount = roomPrice

    // 6. Insert rent bill
    const inserted = await (client as any).insert(rentBills).values({
        roomId,
        tenantId: room.tenantId || null,
        periodStartDate,
        periodEndDate,
        dueDate: periodEndDate,
        billingCycleDay: cycleDay,
        period: meterPeriod,
        periodEnd: null,
        monthsCovered: 1,
        roomPrice: roomPrice.toString(),
        waterFee: '0',
        trashFee: '0',
        totalAmount: totalAmount.toString(),
        isPaid: false,
        generatedAt: new Date(),
    }).returning()

    return inserted[0] ?? null
}
