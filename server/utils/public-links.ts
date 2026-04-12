import crypto from 'crypto'
import { createError, getRequestURL, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { publicInvoiceLinks } from '../database/schema'
import { db } from './drizzle'

function generateShortCode() {
  return crypto.randomBytes(6).toString('base64url')
}

export async function createPublicInvoiceShortLink(event: H3Event, token: string) {
  const existing = await db
    .select({ code: publicInvoiceLinks.code })
    .from(publicInvoiceLinks)
    .where(eq(publicInvoiceLinks.token, token))
    .limit(1)

  if (existing[0]?.code) {
    return {
      code: existing[0].code,
      publicUrl: `${getRequestURL(event).origin}/i/${existing[0].code}`,
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateShortCode()
    const inserted = await db
      .insert(publicInvoiceLinks)
      .values({ code, token })
      .onConflictDoNothing()
      .returning({ code: publicInvoiceLinks.code })

    if (inserted[0]?.code) {
      return {
        code: inserted[0].code,
        publicUrl: `${getRequestURL(event).origin}/i/${inserted[0].code}`,
      }
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Failed to generate short invoice link',
  })
}

export async function resolvePublicInvoiceShortCode(code: string) {
  const result = await db
    .select({ token: publicInvoiceLinks.token })
    .from(publicInvoiceLinks)
    .where(eq(publicInvoiceLinks.code, code))
    .limit(1)

  return result[0]?.token || null
}