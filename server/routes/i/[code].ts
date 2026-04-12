import { resolvePublicInvoiceShortCode } from '../../utils/public-links'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Short code required' })
  }

  const token = await resolvePublicInvoiceShortCode(code)

  if (!token) {
    throw createError({ statusCode: 404, statusMessage: 'Short link not found' })
  }

  return sendRedirect(event, `/invoice/${token}`, 302)
})