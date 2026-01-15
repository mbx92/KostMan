// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ofetch } from 'ofetch'

const BASE_URL = 'http://localhost:3000'

const $fetch = ofetch.create({
    baseURL: BASE_URL
})

describe('Auth Integration', async () => {
    // Avoid setup() to skip app build time, relying on running dev server
    // await setup({ server: true })

    // Use a unique email for each test run to avoid conflicts
    const uniqueId = Date.now()
    const testUser = {
        email: `test_integration_${uniqueId}@example.com`,
        password: 'StrongPassword123!',
        name: 'Integration Test User'
    }

    it('Register > should register a new user successfully', async () => {
        const response = await $fetch('/api/auth/register', {
            method: 'POST',
            body: testUser
        })

        expect(response).toMatchObject({
            email: testUser.email,
            name: testUser.name
        })
        // Expect 'id' and 'role' to be present
        expect(response).toHaveProperty('id')
        expect(response).toHaveProperty('role', 'owner')
    })

    it('Register > should fail if user already exists', async () => {
        try {
            await $fetch('/api/auth/register', {
                method: 'POST',
                body: testUser
            })
            expect.fail('Should have thrown 409 error')
        } catch (error: any) {
            expect(error.response.status).toBe(409)
            // statusText comes from statusMessage in createError
            expect(error.response.statusText).toBe('User already exists')
        }
    })

    let authToken: string;

    it('Login > should login successfully with valid credentials', async () => {
        const response = await $fetch('/api/auth/login', {
            method: 'POST',
            body: {
                email: testUser.email,
                password: testUser.password
            }
        })

        expect(response).toHaveProperty('token')
        expect(response).toHaveProperty('user')
        expect(response.user.email).toBe(testUser.email)

        authToken = response.token
    })

    it('Login > should fail with invalid credentials', async () => {
        try {
            await $fetch('/api/auth/login', {
                method: 'POST',
                body: {
                    email: testUser.email,
                    password: 'WrongPassword'
                }
            })
            expect.fail('Should have thrown 401 error')
        } catch (error: any) {
            expect(error.response.status).toBe(401)
        }
    })

    it('Me > should get current user', async () => {
        const response = await $fetch('/api/auth/me', {
            headers: {
                Cookie: `auth_token=${authToken}`
            }
        })
        expect(response.user).toHaveProperty('email', testUser.email)
    })

    it('Me > should fail if user not logged in (no token)', async () => {
        try {
            await $fetch('/api/auth/me')
            expect.fail('Should have thrown 401 error')
        } catch (error: any) {
            expect(error.response.status).toBe(401)
            expect(error.response.statusText).toBe('Unauthorized')
        }
    })

    it('Me > should fail if token is invalid or expired', async () => {
        try {
            await $fetch('/api/auth/me', {
                headers: {
                    Cookie: 'auth_token=invalid_or_expired_token'
                }
            })
            expect.fail('Should have thrown 403 error')
        } catch (error: any) {
            expect(error.response.status).toBe(403)
            // Middleware throws 'Token invalid or expired' for invalid tokens
            expect(error.response.statusText).toBe('Token invalid or expired')
        }
    })

    it('Logout > should logout successfully', async () => {
        const response = await $fetch('/api/auth/logout', {
            method: 'POST'
        })
        expect(response).toEqual({ message: 'Logged out successfully' })
    })
})
