import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, payments } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { existsSync } from 'node:fs'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const resolvePublicDir = () => {
  const runtimePublicDir = join(process.cwd(), '.output', 'public')
  if (existsSync(runtimePublicDir)) {
    return runtimePublicDir
  }

  return join(process.cwd(), 'public')
}

/**
 * POST /api/bills/upload-proof/[token]
 * Upload payment proof for a bill (no auth required - public endpoint)
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, message: 'Token required' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: 'No form data provided' })
  }

  const fileField = formData.find(f => f.name === 'file')
  if (!fileField?.data || fileField.data.length === 0) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const mimeType = fileField.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw createError({ statusCode: 400, message: 'Invalid file type. Only images (JPG, PNG, GIF, WebP) and PDF are allowed.' })
  }

  if (fileField.data.length > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, message: 'File too large. Maximum size is 5MB.' })
  }

  // Decode token to determine billId and billType
  let decoded: string
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf-8')
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid token' })
  }

  const parts = decoded.split(':')

  let billId: string
  let billType: 'rent' | 'utility'
  let billAmount: string = '0'

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const dualParts = decoded.includes('+') ? decoded.split('+') : null
  const isDualUUID = dualParts?.length === 2 && UUID_REGEX.test(dualParts[0]) && UUID_REGEX.test(dualParts[1])

  if (isDualUUID && dualParts) {
    // Dual bill ID format: rentBillId+utilBillId (cross-period combined)
    const [rentBillId, utilBillId] = dualParts

    const [rentResult, utilResult] = await Promise.all([
      db.select({ id: rentBills.id, totalAmount: rentBills.totalAmount })
        .from(rentBills).where(eq(rentBills.id, rentBillId)).limit(1),
      db.select({ id: utilityBills.id, totalAmount: utilityBills.totalAmount })
        .from(utilityBills).where(eq(utilityBills.id, utilBillId)).limit(1),
    ])

    if (rentResult.length === 0 && utilResult.length === 0) {
      throw createError({ statusCode: 404, message: 'Bill not found' })
    }

    if (rentResult.length > 0) {
      billId = rentResult[0].id
      billType = 'rent'
      const rentAmt = Number(rentResult[0].totalAmount) || 0
      const utilAmt = utilResult.length > 0 ? (Number(utilResult[0].totalAmount) || 0) : 0
      billAmount = String(rentAmt + utilAmt)
    } else {
      billId = utilResult[0].id
      billType = 'utility'
      billAmount = String(Number(utilResult[0].totalAmount) || 0)
    }
  } else if (parts.length === 2 && parts[1].match(/^\d{4}-\d{2}$/)) {
    // Combined format: roomId:period
    const [roomId, period] = parts

    const [rentResult, utilResult] = await Promise.all([
      db.select({ id: rentBills.id, totalAmount: rentBills.totalAmount })
        .from(rentBills)
        .where(and(eq(rentBills.roomId, roomId), eq(rentBills.period, period)))
        .limit(1),
      db.select({ id: utilityBills.id, totalAmount: utilityBills.totalAmount })
        .from(utilityBills)
        .where(and(eq(utilityBills.roomId, roomId), eq(utilityBills.period, period)))
        .limit(1),
    ])

    if (rentResult.length === 0 && utilResult.length === 0) {
      throw createError({ statusCode: 404, message: 'Bill not found' })
    }

    // Use rent bill as the primary record; sum both amounts
    if (rentResult.length > 0) {
      billId = rentResult[0].id
      billType = 'rent'
      const rentAmt = Number(rentResult[0].totalAmount) || 0
      const utilAmt = utilResult.length > 0 ? (Number(utilResult[0].totalAmount) || 0) : 0
      billAmount = String(rentAmt + utilAmt)
    } else {
      billId = utilResult[0].id
      billType = 'utility'
      billAmount = String(Number(utilResult[0].totalAmount) || 0)
    }
  } else if (parts.length >= 2) {
    // Old format: billId:billType[:timestamp]
    const [id, type] = parts
    if (!id || (type !== 'rent' && type !== 'utility')) {
      throw createError({ statusCode: 400, message: 'Invalid token format' })
    }
    billId = id
    billType = type as 'rent' | 'utility'

    if (billType === 'rent') {
      const result = await db.select({ totalAmount: rentBills.totalAmount })
        .from(rentBills).where(eq(rentBills.id, billId)).limit(1)
      if (result.length === 0) throw createError({ statusCode: 404, message: 'Bill not found' })
      billAmount = result[0].totalAmount
    } else {
      const result = await db.select({ totalAmount: utilityBills.totalAmount })
        .from(utilityBills).where(eq(utilityBills.id, billId)).limit(1)
      if (result.length === 0) throw createError({ statusCode: 404, message: 'Bill not found' })
      billAmount = result[0].totalAmount
    }
  } else {
    throw createError({ statusCode: 400, message: 'Invalid token format' })
  }

  // In production Nuxt serves static assets from .output/public, while local dev uses public.
  const proofsDir = join(resolvePublicDir(), 'bills', 'proofs')
  if (!existsSync(proofsDir)) {
    await mkdir(proofsDir, { recursive: true })
  }

  const ext = extname(fileField.filename || '') || (mimeType === 'application/pdf' ? '.pdf' : '.jpg')
  const filename = `${billId}-${Date.now()}${ext}`
  const filePath = join(proofsDir, filename)
  await writeFile(filePath, fileField.data)

  const proofUrl = `/bills/proofs/${filename}`

  // Create a pending payment record
  await db.insert(payments).values({
    billId,
    billType,
    amount: billAmount,
    paymentMethod: 'transfer',
    paymentDate: new Date(),
    status: 'pending',
    notes: `Bukti transfer: ${proofUrl}`,
    recordedBy: null,
  })

  return {
    success: true,
    proofUrl,
  }
})
