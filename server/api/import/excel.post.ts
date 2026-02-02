import { z } from 'zod'
import { db, users, properties, propertySettings, tenants, rooms, meterReadings } from '../../database'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcrypt'

// Validation Schema
const importDataSchema = z.object({
    data: z.array(z.object({
        users_email: z.string().email().transform(v => v.toLowerCase().trim()),
        property_name: z.string().transform(v => v.trim()),
        property_address: z.string().optional().nullable().transform(v => v?.trim() || null),
        property_description: z.string().optional().nullable().transform(v => v?.trim() || null),
        rooms_name: z.string().transform(v => v.trim()),
        rooms_price: z.number(),
        property_settings_cost_per_kwh: z.number(),
        water: z.number(),
        trash: z.number(),
        room_status: z.enum(['available', 'occupied', 'maintenance']),
        use_trash_service: z.boolean(),
        move_in_date: z.number().optional().nullable(),
        ocupant_count: z.number().optional().default(1),
        tenant_name: z.string().optional().nullable().transform(v => v?.trim() || null),
        // Coerce numbers to strings for NIK and phone (Excel parses them as numbers)
        tenant_id_card_number: z.union([z.string(), z.number()]).transform(val => String(val).trim()).optional().nullable(),
        tenant_phone: z.union([z.string(), z.number()]).transform(val => String(val).trim()).optional().nullable(),
        meter_start: z.number().optional().nullable(),
        meter_end: z.number().optional().nullable(),
        recorder_by: z.string().optional().nullable().transform(v => v?.trim().toLowerCase() || null)
    })),
    options: z.object({
        skipDuplicates: z.boolean().default(true),
        updateExisting: z.boolean().default(false),
        generateDefaultPassword: z.boolean().default(true),
        generateDefaultPin: z.boolean().default(true),
        targetPeriod: z.string().optional()
    }).default({
        skipDuplicates: true,
        updateExisting: false,
        generateDefaultPassword: true,
        generateDefaultPin: true
    })
})

export default defineEventHandler(async (event) => {
    try {
        // Validate request body
        const body = await readBody(event)

        // Debug logging
        console.log('=== IMPORT REQUEST DEBUG ===')
        console.log('Body keys:', Object.keys(body || {}))
        console.log('Data length:', body?.data?.length)
        console.log('First row sample:', body?.data?.[0])
        console.log('Options:', body?.options)

        const validated = importDataSchema.parse(body)

        const { data: excelData, options } = validated

        // Initialize stats
        const stats = {
            created: 0,
            updated: 0,
            skipped: 0
        }

        const details = {
            users: 0,
            properties: 0,
            propertySettings: 0,
            tenants: 0,
            rooms: 0
        }

        // Maps to store IDs
        const userIdMap = new Map<string, string>()
        const propertyIdMap = new Map<string, string>()
        const tenantIdMap = new Map<string, string>()

        // Helper to normalize phone number
        const normalizePhoneNumber = (phone: string | null | undefined): string => {
            if (!phone) return '081000000000' // Default dummy

            let clean = phone.toString().replace(/\D/g, '')

            // Handle dummy data specifically
            if (/^0+$/.test(clean) || clean === '0' || clean.length < 5) {
                return '081000000000'
            }

            // Normalize prefix
            if (clean.startsWith('62')) {
                clean = '0' + clean.slice(2)
            } else if (!clean.startsWith('0')) {
                clean = '0' + clean
            }

            return clean
        }

        // Start transaction
        await db.transaction(async (tx) => {
            // Step 1: Import Users
            const uniqueEmails = [...new Set(excelData.map(row => row.users_email))]

            for (const email of uniqueEmails) {
                // Check if user exists
                const existingUser = await tx.query.users.findFirst({
                    where: eq(users.email, email)
                })

                if (existingUser) {
                    // Update existing user if needed
                    // Only update simple fields, preserve complex status if not critical
                    userIdMap.set(email, existingUser.id)
                    stats.updated++ // Count as processed
                } else {
                    // Create new user
                    const defaultPassword = options.generateDefaultPassword
                        ? await bcrypt.hash('password123', 10)
                        : await bcrypt.hash('password123', 10)

                    const [newUser] = await tx.insert(users).values({
                        email,
                        name: email.split('@')[0], // Extract name from email
                        password: defaultPassword,
                        role: 'owner',
                        status: 'active'
                    }).returning()

                    userIdMap.set(email, newUser.id)
                    details.users++
                    stats.created++
                }
            }

            // Step 2: Import Properties
            // Group by user and property name
            const propertiesMap = new Map<string, any>()

            excelData.forEach(row => {
                const userId = userIdMap.get(row.users_email)
                if (!userId) {
                    console.error(`Skipping property for missing user: ${row.users_email}`)
                    return
                }

                // Create a composite key that is robust
                const key = `${row.users_email}::${row.property_name.toLowerCase()}`

                if (!propertiesMap.has(key)) {
                    propertiesMap.set(key, {
                        userId: userId,
                        name: row.property_name,
                        address: row.property_address || 'Alamat belum diisi',
                        description: row.property_description || null,
                        costPerKwh: row.property_settings_cost_per_kwh,
                        waterFee: row.water,
                        trashFee: row.trash
                    })
                }
            })

            console.log(`Processing ${propertiesMap.size} properties...`)

            for (const [key, propData] of propertiesMap) {
                // Check if property exists
                const existingProperty = await tx.query.properties.findFirst({
                    where: and(
                        eq(properties.userId, propData.userId),
                        eq(properties.name, propData.name)
                    )
                })

                if (existingProperty) {
                    // Update existing property
                    const [updated] = await tx.update(properties)
                        .set({
                            address: propData.address,
                            description: propData.description
                        })
                        .where(eq(properties.id, existingProperty.id))
                        .returning()

                    propertyIdMap.set(key, updated.id)

                    // Also update property settings
                    await tx.update(propertySettings)
                        .set({
                            costPerKwh: propData.costPerKwh.toString(),
                            waterFee: propData.waterFee.toString(),
                            trashFee: propData.trashFee.toString()
                        })
                        .where(eq(propertySettings.propertyId, existingProperty.id))

                    stats.updated++
                    details.properties++
                } else {
                    // Create new property
                    const [newProperty] = await tx.insert(properties).values({
                        userId: propData.userId,
                        name: propData.name,
                        address: propData.address,
                        description: propData.description
                    }).returning()

                    propertyIdMap.set(key, newProperty.id)
                    details.properties++
                    stats.created++

                    // Create property settings
                    await tx.insert(propertySettings).values({
                        propertyId: newProperty.id,
                        costPerKwh: propData.costPerKwh.toString(),
                        waterFee: propData.waterFee.toString(),
                        trashFee: propData.trashFee.toString()
                    })

                    details.propertySettings++
                }
            }

            // Step 3: Import Tenants
            // Extract unique tenants
            const tenantsMap = new Map<string, any>()

            excelData.forEach(row => {
                if (row.tenant_name && row.room_status === 'occupied') {
                    // Normalize phone first for key generation to handle duplicates correctly
                    const rawPhone = row.tenant_phone ? String(row.tenant_phone) : null
                    const normalizedPhone = normalizePhoneNumber(rawPhone)

                    // Use a composite key that is robust
                    const key = `${row.tenant_name.toLowerCase()}::${normalizedPhone}`

                    if (!tenantsMap.has(key)) {
                        tenantsMap.set(key, {
                            name: row.tenant_name,
                            contact: normalizedPhone,
                            idCardNumber: row.tenant_id_card_number ? String(row.tenant_id_card_number) : '0000000000000000',
                            status: 'active'
                        })
                    }
                }
            })

            console.log(`Processing ${tenantsMap.size} tenants...`)

            for (const [key, tenantData] of tenantsMap) {
                // Check if tenant exists
                const existingTenant = await tx.query.tenants.findFirst({
                    where: and(
                        eq(tenants.name, tenantData.name),
                        eq(tenants.contact, tenantData.contact)
                    )
                })

                if (existingTenant) {
                    await tx.update(tenants)
                        .set({
                            idCardNumber: tenantData.idCardNumber,
                            status: tenantData.status
                        })
                        .where(eq(tenants.id, existingTenant.id))

                    tenantIdMap.set(key, existingTenant.id)
                    stats.updated++
                    details.tenants++
                } else {
                    const defaultPin = options.generateDefaultPin
                        ? await bcrypt.hash('1234', 10)
                        : null

                    const [newTenant] = await tx.insert(tenants).values({
                        name: tenantData.name,
                        contact: tenantData.contact,
                        idCardNumber: tenantData.idCardNumber,
                        status: tenantData.status,
                        pin: defaultPin,
                        isDefaultPin: true
                    }).returning()

                    tenantIdMap.set(key, newTenant.id)
                    details.tenants++
                    stats.created++
                }
            }

            // Step 4: Import Rooms
            console.log(`Processing rooms...`)
            for (const row of excelData) {
                const propertyKey = `${row.users_email}::${row.property_name.toLowerCase()}`
                const propertyId = propertyIdMap.get(propertyKey)

                if (!propertyId) {
                    console.error(`Property not found for room: ${row.rooms_name} (Key: ${propertyKey})`)
                    // Attempt to find it in the map - maybe some case issue persisted?
                    console.log('Available keys:', Array.from(propertyIdMap.keys()))
                    continue
                }

                // Get tenant ID if occupied
                let tenantId = null
                if (row.room_status === 'occupied' && row.tenant_name) {
                    const rawPhone = row.tenant_phone ? String(row.tenant_phone) : null
                    const normalizedPhone = normalizePhoneNumber(rawPhone)

                    const tenantKey = `${row.tenant_name.toLowerCase()}::${normalizedPhone}`
                    tenantId = tenantIdMap.get(tenantKey) || null

                    if (!tenantId) {
                        console.warn(`Tenant not found for room ${row.rooms_name}: ${row.tenant_name} (Key: ${tenantKey})`)
                    }
                }

                // Convert move_in_date from number to Date
                let moveInDate = null
                if (row.move_in_date) {
                    try {
                        const dateStr = row.move_in_date.toString()
                        if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            moveInDate = `${year}-${month}-${day}`
                        } else {
                            // Fallback for weird formats if any
                            console.warn(`Invalid date format for room ${row.rooms_name}: ${dateStr}`)
                        }
                    } catch (e) {
                        console.warn(`Error parsing date for room ${row.rooms_name}`, e)
                    }
                }

                // Check if room exists
                const existingRoom = await tx.query.rooms.findFirst({
                    where: and(
                        eq(rooms.propertyId, propertyId),
                        eq(rooms.name, row.rooms_name)
                    )
                })

                let roomId = null

                if (existingRoom) {
                    await tx.update(rooms)
                        .set({
                            tenantId,
                            price: row.rooms_price.toString(),
                            status: row.room_status,
                            useTrashService: row.use_trash_service,
                            moveInDate,
                            occupantCount: row.ocupant_count
                        })
                        .where(eq(rooms.id, existingRoom.id))

                    roomId = existingRoom.id
                    stats.updated++
                    details.rooms++
                } else {
                    const [newRoom] = await tx.insert(rooms).values({
                        propertyId,
                        tenantId,
                        name: row.rooms_name,
                        price: row.rooms_price.toString(),
                        status: row.room_status,
                        useTrashService: row.use_trash_service,
                        moveInDate,
                        occupantCount: row.ocupant_count
                    }).returning()

                    roomId = newRoom.id
                    details.rooms++
                    stats.created++
                }

                // Step 5: Import Meter Readings (if provided)
                if (roomId && (row.meter_start !== undefined || row.meter_end !== undefined)) {
                    // Normalize values
                    const startRaw = row.meter_start
                    const endRaw = row.meter_end

                    if (startRaw !== null && startRaw !== undefined && endRaw !== null && endRaw !== undefined) {
                        const recorderEmail = row.recorder_by
                        const recorderId = recorderEmail ? userIdMap.get(recorderEmail) : null

                        const now = new Date()
                        const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                        const period = options.targetPeriod || defaultPeriod

                        const existingReading = await tx.query.meterReadings.findFirst({
                            where: and(
                                eq(meterReadings.roomId, roomId),
                                eq(meterReadings.period, period)
                            )
                        })

                        if (existingReading) {
                            await tx.update(meterReadings)
                                .set({
                                    meterStart: Math.round(startRaw),
                                    meterEnd: Math.round(endRaw),
                                    recordedBy: recorderId,
                                    recordedAt: new Date()
                                })
                                .where(eq(meterReadings.id, existingReading.id))
                        } else {
                            await tx.insert(meterReadings).values({
                                roomId,
                                period,
                                meterStart: Math.round(startRaw),
                                meterEnd: Math.round(endRaw),
                                recordedBy: recorderId,
                                recordedAt: new Date()
                            })
                        }
                    }
                }
            }
        })

        return {
            success: true,
            message: 'Data berhasil diimport',
            stats,
            details
        }

    } catch (error: any) {
        console.error('Import error:', error)

        if (error.name === 'ZodError' || error.issues) {
            const errorMessages = error.issues?.map((issue: any) => {
                const path = issue.path.join('.')
                return `${path}: ${issue.message}`
            }) || ['Validation failed']

            throw createError({
                statusCode: 400,
                message: 'Validation error: ' + errorMessages.join(', '),
                data: {
                    validationErrors: error.issues || error.errors,
                    details: errorMessages
                }
            })
        }

        throw createError({
            statusCode: 500,
            message: error.message || 'Import failed'
        })
    }
})
