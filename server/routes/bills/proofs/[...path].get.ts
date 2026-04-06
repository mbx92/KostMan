import { createReadStream, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { getProofStorageCandidates } from '../../../utils/payment-proof-storage'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export default defineEventHandler((event) => {
  const requestedPath = getRouterParam(event, 'path')
  if (!requestedPath) {
    throw createError({ statusCode: 400, message: 'File path required' })
  }

  const fileName = basename(requestedPath)
  const filePath = getProofStorageCandidates()
    .map(dir => join(dir, fileName))
    .find(candidate => existsSync(candidate))

  if (!filePath) {
    throw createError({ statusCode: 404, message: `Page not found: /bills/proofs/${fileName}` })
  }

  const contentType = CONTENT_TYPES[extname(fileName).toLowerCase()] || 'application/octet-stream'
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return sendStream(event, createReadStream(filePath))
})