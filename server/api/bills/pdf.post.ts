import { promises as fs } from 'fs'
import { join } from 'path'
import { generateCombinedPdf, type BillData } from '../../utils/pdf-generator'
import { db } from '../../utils/drizzle'
import { rentBills, utilityBills, rooms, properties, tenants } from '../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ roomId: string; period: string }>(event)
  
  if (!body.roomId || !body.period) {
    throw createError({
      statusCode: 400,
      statusMessage: 'roomId and period are required'
    })
  }

  // Fetch room data
  const [room] = await db.select().from(rooms).where(eq(rooms.id, body.roomId))
  if (!room) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Room not found'
    })
  }

  // Fetch property data
  const [property] = await db.select().from(properties).where(eq(properties.id, room.propertyId))
  if (!property) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Property not found'
    })
  }

  // Fetch tenant data if exists
  let tenant = null
  if (room.tenantId) {
    const [tenantData] = await db.select().from(tenants).where(eq(tenants.id, room.tenantId))
    tenant = tenantData || null
  }

  // Fetch rent bill for this period
  const [rentBill] = await db.select().from(rentBills).where(
    and(
      eq(rentBills.roomId, body.roomId),
      eq(rentBills.period, body.period)
    )
  )

  // Fetch utility bill for this period
  const [utilityBill] = await db.select().from(utilityBills).where(
    and(
      eq(utilityBills.roomId, body.roomId),
      eq(utilityBills.period, body.period)
    )
  )

  if (!rentBill && !utilityBill) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No bills found for this room and period'
    })
  }

  // Prepare bill data for PDF generation
  const billData: BillData = {
    property: {
      name: property.name,
      address: property.address
    },
    room: {
      name: room.name
    },
    tenant: tenant ? { name: tenant.name } : null,
    period: body.period,
    rentBill: rentBill ? {
      id: rentBill.id,
      monthsCovered: rentBill.monthsCovered || 1,
      roomPrice: rentBill.roomPrice,
      totalAmount: rentBill.totalAmount,
      isPaid: rentBill.isPaid,
      generatedAt: rentBill.generatedAt.toISOString()
    } : undefined,
    utilityBill: utilityBill ? {
      id: utilityBill.id,
      meterStart: utilityBill.meterStart,
      meterEnd: utilityBill.meterEnd,
      costPerKwh: utilityBill.costPerKwh,
      usageCost: utilityBill.usageCost,
      waterFee: utilityBill.waterFee,
      trashFee: utilityBill.trashFee,
      additionalCost: utilityBill.additionalCost,
      totalAmount: utilityBill.totalAmount,
      isPaid: utilityBill.isPaid,
      generatedAt: utilityBill.generatedAt.toISOString()
    } : undefined
  }

  // Generate PDF
  const pdfBuffer = generateCombinedPdf(billData)

  // Create bills directory in public folder if not exists
  const publicDir = join(process.cwd(), 'public', 'bills')
  try {
    await fs.access(publicDir)
  } catch {
    await fs.mkdir(publicDir, { recursive: true })
  }

  // Generate unique filename
  const timestamp = Date.now()
  const safeRoomName = room.name.replace(/[^a-zA-Z0-9]/g, '-')
  const filename = `statement-${safeRoomName}-${body.period}-${timestamp}.pdf`
  const filePath = join(publicDir, filename)

  // Save PDF file
  await fs.writeFile(filePath, pdfBuffer)

  // Return the public URL path
  const pdfUrl = `/bills/${filename}`

  return {
    success: true,
    pdfUrl,
    filename,
    tenant: tenant ? {
      name: tenant.name,
      contact: tenant.contact
    } : null
  }
})
