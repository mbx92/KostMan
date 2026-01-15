import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock environment variables
process.env.NUXT_SESSION_PASSWORD = 'test-secret'

const mocks = vi.hoisted(() => {
    const mockLimit = vi.fn()
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
    const mockReturning = vi.fn()
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockHash = vi.fn()
    const mockCompare = vi.fn()

    const mockSign = vi.fn()
    const mockVerify = vi.fn()

    const mockRegisterSafeParse = vi.fn()
    const mockLoginSafeParse = vi.fn()

    return {
        mockLimit,
        mockWhere,
        mockFrom,
        mockSelect,
        mockReturning,
        mockValues,
        mockInsert,
        mockHash,
        mockCompare,
        mockSign,
        mockVerify,
        mockRegisterSafeParse,
        mockLoginSafeParse
    }
})

vi.mock('../../server/utils/drizzle', () => ({
    db: {
        select: mocks.mockSelect,
        insert: mocks.mockInsert
    }
}))

vi.mock('bcrypt', () => ({
    default: {
        hash: mocks.mockHash,
        compare: mocks.mockCompare
    }
}))

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: mocks.mockSign,
        verify: mocks.mockVerify
    }
}))

vi.mock('../../server/validations/auth', () => ({
    registerSchema: {
        safeParse: mocks.mockRegisterSafeParse
    },
    loginSchema: {
        safeParse: mocks.mockLoginSafeParse
    }
}))

// Stub Nuxt/H3 utils
const mockReadBody = vi.fn()
const mockCreateError = vi.fn((err) => err)
const mockSetCookie = vi.fn()
const mockDeleteCookie = vi.fn()
const mockDefineEventHandler = (handler: any) => handler

vi.stubGlobal('readBody', mockReadBody)
vi.stubGlobal('createError', mockCreateError)
vi.stubGlobal('setCookie', mockSetCookie)
vi.stubGlobal('deleteCookie', mockDeleteCookie)
vi.stubGlobal('defineEventHandler', mockDefineEventHandler)

// Import handlers after mocking
// Use dynamic imports to ensure globals are set before module evaluation
const { default: RegisterHandler } = await import('../../server/api/auth/register.post')
const { default: LoginHandler } = await import('../../server/api/auth/login.post')
const { default: LogoutHandler } = await import('../../server/api/auth/logout.post')

describe('Auth API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.mockRegisterSafeParse.mockImplementation((data) => ({ success: true, data }))
        mocks.mockLoginSafeParse.mockImplementation((data) => ({ success: true, data }))
    })

    describe('Register', () => {
        it('should register a new user successfully', async () => {
            const userData = { email: 'test@example.com', password: 'password123', name: 'Test User' }
            mockReadBody.mockResolvedValue(userData)
            mocks.mockLimit.mockResolvedValue([]) // No existing user
            mocks.mockHash.mockResolvedValue('hashed_password')
            mocks.mockReturning.mockResolvedValue([{ id: 1, ...userData, role: 'owner' }])

            // Validation mock setup for success
            mocks.mockRegisterSafeParse.mockReturnValue({ success: true, data: userData })

            const result = await RegisterHandler({} as any)

            expect(result).toMatchObject({
                email: userData.email,
                name: userData.name
            })
            expect(mocks.mockInsert).toHaveBeenCalled()
        })

        it('should fail if user already exists', async () => {
            const userData = { email: 'existing@example.com', password: 'password123', name: 'Existing User' }
            mockReadBody.mockResolvedValue(userData)
            mocks.mockLimit.mockResolvedValue([userData]) // User exists

            mocks.mockRegisterSafeParse.mockReturnValue({ success: true, data: userData })


            try {
                await RegisterHandler({} as any)
            } catch (error: any) {
                expect(error.statusCode).toBe(409)
                expect(error.statusMessage).toBe('User already exists')
            }
        })
    })

    describe('Login', () => {
        it('should login successfully with valid credentials', async () => {
            const loginData = { email: 'test@example.com', password: 'password123' }
            const userInDb = { id: 1, ...loginData, password: 'hashed_password', role: 'owner', name: 'Test User' }

            mockReadBody.mockResolvedValue(loginData)
            mocks.mockLimit.mockResolvedValue([userInDb])
            mocks.mockCompare.mockResolvedValue(true)
            mocks.mockSign.mockReturnValue('mock_token')

            mocks.mockLoginSafeParse.mockReturnValue({ success: true, data: loginData })

            const result = await LoginHandler({} as any)

            expect(result).toHaveProperty('token', 'mock_token')
            expect(result.user).toHaveProperty('email', loginData.email)
            expect(mockSetCookie).toHaveBeenCalled()
        })

        it('should fail with invalid credentials', async () => {
            const loginData = { email: 'test@example.com', password: 'wrongpassword' }
            const userInDb = { id: 1, ...loginData, password: 'hashed_password', role: 'owner', name: 'Test User' }

            mockReadBody.mockResolvedValue(loginData)
            mocks.mockLimit.mockResolvedValue([userInDb])
            mocks.mockCompare.mockResolvedValue(false)

            mocks.mockLoginSafeParse.mockReturnValue({ success: true, data: loginData })

            try {
                await LoginHandler({} as any)
            } catch (error: any) {
                expect(error.statusCode).toBe(401)
                expect(error.statusMessage).toBe('Invalid credentials')
            }
        })
    })

    describe('Logout', () => {
        it('should logout successfully', async () => {
            const result = await LogoutHandler({} as any)
            expect(mockDeleteCookie).toHaveBeenCalledWith(expect.anything(), 'auth_token')
            expect(result).toEqual({ message: 'Logged out successfully' })
        })
    })
})
