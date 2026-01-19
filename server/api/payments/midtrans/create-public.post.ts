import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, rooms, tenants, properties, integrationSettings, users } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '../../../utils/encryption'

interface CreatePaymentInput {
  billId: string
  billType: 'rent' | 'utility'
}

/**
 * POST /api/payments/midtrans/create-public
 * Creates a Snap transaction token for payment (public access, no auth required)
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CreatePaymentInput>(event)

  if (!body.billId || !body.billType) {
    throw createError({
      statusCode: 400,
      statusMessage: 'billId and billType are required',
    })
  }

  // Get bill details
  let bill: any
  let room: any
  let tenant: any
  let property: any
  let userId: string

  if (body.billType === 'rent') {
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
  if (bill.isPaid) {
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

  // Generate order ID
  const shortBillId = body.billId.split('-')[0]
  const orderId = `${body.billType === 'rent' ? 'R' : 'U'}-${shortBillId}-${Date.now()}`
  const grossAmount = Math.round(Number(bill.totalAmount))

  // Build item details
  const itemDetails =
    body.billType === 'rent'
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
    metadata: {
      bill_id: body.billId,
      bill_type: body.billType,
    },
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
