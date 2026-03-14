import { db } from '../../utils/drizzle'
import { payments, rentBills, utilityBills, rooms, tenants, properties } from '../../database/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireRole, Role } from '../../utils/permissions'

/**
 * GET /api/payments/confirmations
 * Get all pending payments (awaiting confirmation) with bill/room/tenant info
 * Also supports ?status=all to include completed payments
 */
export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const query = getQuery(event)
  const status = (query.status as string) || 'pending'

  const statusCondition = status === 'all'
    ? undefined
    : eq(payments.status, status as any)

  // Query for rent bill payments
  const rentResults = await db
    .select({
      payment: payments,
      bill: rentBills,
      room: rooms,
      tenant: tenants,
      property: properties,
    })
    .from(payments)
    .leftJoin(rentBills, eq(payments.billId, rentBills.id))
    .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
    .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(statusCondition
      ? and(eq(payments.billType, 'rent'), statusCondition)
      : eq(payments.billType, 'rent')
    )
    .orderBy(desc(payments.createdAt))

  // Query for utility bill payments
  const utilResults = await db
    .select({
      payment: payments,
      bill: utilityBills,
      room: rooms,
      tenant: tenants,
      property: properties,
    })
    .from(payments)
    .leftJoin(utilityBills, eq(payments.billId, utilityBills.id))
    .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
    .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(statusCondition
      ? and(eq(payments.billType, 'utility'), statusCondition)
      : eq(payments.billType, 'utility')
    )
    .orderBy(desc(payments.createdAt))

  const combined = [
    ...rentResults.map(r => ({
      ...r.payment,
      billType: 'rent' as const,
      billPeriod: r.bill?.period,
      billTotal: r.bill?.totalAmount,
      billIsPaid: r.bill?.isPaid ?? false,
      billRemainingAmount: r.bill ? String(Math.max(0, Number(r.bill.totalAmount) - Number(r.bill.paidAmount || 0))) : null,
      roomId: r.room?.id,
      roomName: r.room?.name,
      propertyName: r.property?.name,
      tenantName: r.tenant?.name,
      pairedBill: null as { id: string; billType: 'rent' | 'utility'; totalAmount: string; remainingAmount: string; isPaid: boolean } | null,
    })),
    ...utilResults.map(r => ({
      ...r.payment,
      billType: 'utility' as const,
      billPeriod: r.bill?.period,
      billTotal: r.bill?.totalAmount,
      billIsPaid: r.bill?.isPaid ?? false,
      billRemainingAmount: r.bill ? String(Math.max(0, Number(r.bill.totalAmount) - Number(r.bill.paidAmount || 0))) : null,
      roomId: r.room?.id,
      roomName: r.room?.name,
      propertyName: r.property?.name,
      tenantName: r.tenant?.name,
      pairedBill: null as { id: string; billType: 'rent' | 'utility'; totalAmount: string; remainingAmount: string; isPaid: boolean } | null,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Look up paired bills for pending payments
  for (const item of combined) {
    if (item.status !== 'pending' || !item.roomId || !item.billPeriod) continue

    if (item.billType === 'rent') {
      const [paired] = await db
        .select({ id: utilityBills.id, totalAmount: utilityBills.totalAmount, paidAmount: utilityBills.paidAmount, isPaid: utilityBills.isPaid })
        .from(utilityBills)
        .where(and(eq(utilityBills.roomId, item.roomId), eq(utilityBills.period, item.billPeriod)))
        .limit(1)
      if (paired) {
        item.pairedBill = {
          id: paired.id,
          billType: 'utility',
          totalAmount: paired.totalAmount,
          remainingAmount: String(Math.max(0, Number(paired.totalAmount) - Number(paired.paidAmount || 0))),
          isPaid: paired.isPaid ?? false,
        }
      }
    } else {
      const [paired] = await db
        .select({ id: rentBills.id, totalAmount: rentBills.totalAmount, paidAmount: rentBills.paidAmount, isPaid: rentBills.isPaid })
        .from(rentBills)
        .where(and(eq(rentBills.roomId, item.roomId), eq(rentBills.period, item.billPeriod)))
        .limit(1)
      if (paired) {
        item.pairedBill = {
          id: paired.id,
          billType: 'rent',
          totalAmount: paired.totalAmount,
          remainingAmount: String(Math.max(0, Number(paired.totalAmount) - Number(paired.paidAmount || 0))),
          isPaid: paired.isPaid ?? false,
        }
      }
    }
  }

  return { payments: combined }
})