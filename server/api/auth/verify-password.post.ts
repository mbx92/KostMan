import { users } from '../../database/schema'
import { db } from '../../utils/drizzle'
import { requireLogin } from '../../utils/permissions'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required')
})

export default defineEventHandler(async (event) => {
  const sessionUser = requireLogin(event)
  const body = await readBody(event)

  const { password } = verifyPasswordSchema.parse(body)

  // Fetch user with password
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  const user = userResult[0]

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password)

  if (!validPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password'
    })
  }

  return {
    success: true,
    message: 'Password verified'
  }
})
