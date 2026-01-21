import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, rooms, tenants, properties, integrationSettings, users } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '../../../utils/encryption'

interface CreatePaymentInput {
  billId?: string
  billType: 'rent' | 'utility' | 'combined'
  roomId?: string
  period?: string
}

/**
 * POST /api/payments/midtrans/create-public
 * Creates a Snap transaction token for payment (public access, no auth required)
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CreatePaymentInput>(event)

  if (!body.billType) {
    throw createError({
      statusCode: 400,
      statusMessage: 'billType is required',
    })
  }

  if (body.billType === 'combined' && (!body.roomId || !body.period)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'roomId and period are required for combined bills',
    })
  }

  if (body.billType !== 'combined' && !body.billId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'billId is required for single bills',
    })
  }

  // Get bill details
  let bill: any
  let rentBill: any
  let utilityBill: any
  let room: any
  let tenant: any
  let property: any
  let userId: string

  if (body.billType === 'combined') {
    // Fetch both rent and utility bills
    const rentResult = await db
      .select({
        bill: rentBills,
        room: rooms,
        tenant: tenants,
        property: properties,
      })
      .from(rentBills)
      .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
      .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(eq(rentBills.roomId, body.roomId!), eq(rentBills.period, body.period!)))
      .limit(1)

    const utilityResult = await db
      .select({
        bill: utilityBills,
        room: rooms,
        tenant: tenants,
        property: properties,
      })
      .from(utilityBills)
      .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
      .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(eq(utilityBills.roomId, body.roomId!), eq(utilityBills.period, body.period!)))
      .limit(1)

    if (rentResult.length === 0 && utilityResult.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'No bills found for this room and period' })
    }

    rentBill = rentResult.length > 0 ? rentResult[0].bill : null
    utilityBill = utilityResult.length > 0 ? utilityResult[0].bill : null
    room = rentResult.length > 0 ? rentResult[0].room : utilityResult[0].room
    tenant = rentResult.length > 0 ? rentResult[0].tenant : utilityResult[0].tenant
    property = rentResult.length > 0 ? rentResult[0].property : utilityResult[0].property
    userId = property?.userId

    // Check if both bills are already paid
    const bothPaid = (!rentBill || rentBill.isPaid) && (!utilityBill || utilityBill.isPaid)
    if (bothPaid) {
      throw createError({ statusCode: 400, statusMessage: 'All bills are already paid' })
    }
  } else if (body.billType === 'rent') {
    const result = await db
      .select({
        bill: rentBills,
        room: rooms,
        tenant: tenants,
        property: properties,
      })
      .from(rentBills)
      .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
      .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(eq(rentBills.id, body.billId))
      .limit(1)

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Rent bill not found' })
    }

    bill = result[0].bill
    room = result[0].room
    tenant = result[0].tenant
    property = result[0].property
    userId = property?.userId
  } else {
    const result = await db
      .select({
        bill: utilityBills,
        room: rooms,
        tenant: tenants,
        property: properties,
      })
      .from(utilityBills)
      .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
      .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(eq(utilityBills.id, body.billId))
      .limit(1)

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Utility bill not found' })
    }

    bill = result[0].bill
    room = result[0].room
    tenant = result[0].tenant
    property = result[0].property
    userId = property?.userId
  }

  // Check if already paid
  if (bill && bill.isPaid) {
    throw createError({ statusCode: 400, statusMessage: 'Bill is already paid' })
  }

  // Get property owner's Midtrans configuration from database
  const midtransConfig = await db
    .select()
    .from(integrationSettings)
    .where(
      and(
        eq(integrationSettings.userId, userId),
        eq(integrationSettings.provider, 'midtrans'),
        eq(integrationSettings.isEnabled, true)
      )
    )
    .then((rows) => rows[0])

  if (!midtransConfig || !midtransConfig.serverKey || !midtransConfig.clientKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Midtrans integration not configured. Please contact property owner.',
    })
  }

  const serverKey = decrypt(midtransConfig.serverKey)
  const clientKey = midtransConfig.clientKey
  const isProduction = midtransConfig.isProduction
  const baseUrl = isProduction
    ? 'https://app.midtrans.com/snap/v1'
    : 'https://app.sandbox.midtrans.com/snap/v1'

  // Generate order ID and calculate amount
  let orderId: string
  let grossAmount: number
  let itemDetails: any[]
  let metadata: any

  if (body.billType === 'combined') {
    // Combined payment
    const timestamp = Date.now()
    orderId = `C-${body.roomId!.split('-')[0]}-${timestamp}`
    
    // Calculate total amount from both bills (only unpaid ones)
    let totalAmount = 0
    itemDetails = []
    
    if (rentBill && !rentBill.isPaid) {
      const rentAmount = Math.round(Number(rentBill.totalAmount))
      totalAmount += rentAmount
      itemDetails.push({
        id: rentBill.id,
        name: `Sewa Kamar ${room?.name || ''} - ${rentBill.period}`,
        price: rentAmount,
        quantity: 1,
      })
    }
    
    if (utilityBill && !utilityBill.isPaid) {
      const utilityAmount = Math.round(Number(utilityBill.totalAmount))
      totalAmount += utilityAmount
      itemDetails.push({
        id: utilityBill.id,
        name: `Utilitas ${room?.name || ''} - ${utilityBill.period}`,
        price: utilityAmount,
        quantity: 1,
      })
    }
    
    grossAmount = totalAmount
    metadata = {
      bill_type: 'combined',
      room_id: body.roomId,
      period: body.period,
      rent_bill_id: rentBill?.id || null,
      utility_bill_id: utilityBill?.id || null,
    }
  } else {
    // Single bill payment
    const shortBillId = body.billId!.split('-')[0]
    orderId = `${body.billType === 'rent' ? 'R' : 'U'}-${shortBillId}-${Date.now()}`
    grossAmount = Math.round(Number(bill.totalAmount))
    
    itemDetails = body.billType === 'rent'
      ? [
          {
            id: body.billId,
            name: `Sewa Kamar ${room?.name || ''} - ${bill.period}`,
            price: grossAmount,
            quantity: 1,
          },
        ]
      : [
          {
            id: body.billId,
            name: `Utilitas ${room?.name || ''} - ${bill.period}`,
            price: grossAmount,
            quantity: 1,
          },
        ]
    
    metadata = {
      bill_id: body.billId,
      bill_type: body.billType,
    }
  }

  // Snap transaction payload
  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    item_details: itemDetails,
    customer_details: {
      first_name: tenant?.name || 'Guest',
      phone: tenant?.contact || '',
    },
    callbacks: {
      finish: `${getRequestURL(event).origin}/invoice?payment=success`,
      error: `${getRequestURL(event).origin}/invoice?payment=error`,
      pending: `${getRequestURL(event).origin}/invoice?payment=pending`,
    },
    metadata: metadata,
  }

  // Call Midtrans Snap API
  const authString = Buffer.from(`${serverKey}:`).toString('base64')

  try {
    const response = await $fetch<{ token: string; redirect_url: string }>(
      `${baseUrl}/transactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authString}`,
        },
        body: payload,
      }
    )

    return {
      success: true,
      snapToken: response.token,
      redirectUrl: response.redirect_url,
      orderId,
      clientKey: clientKey,
    }
  } catch (error: any) {
    console.error('Midtrans API error:', error?.data || error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create payment transaction',
      data: error?.data,
    })
  }
})
