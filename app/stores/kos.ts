import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface PropertySettings {
    id?: string
    propertyId?: string
    costPerKwh: number | string
    trashFee: number | string
    waterFee: number | string
}

export interface Property {
    id: string
    userId?: string
    name: string
    address: string
    description: string
    image: string
    mapUrl?: string
    settings?: PropertySettings | null
    createdAt?: string
    updatedAt?: string
    roomCount?: number
    occupantCount?: number
    occupantPercentage?: number
}

export interface Room {
    id: string
    propertyId: string
    tenantId?: string | null
    name: string
    price: number | string
    status: 'available' | 'occupied' | 'maintenance'
    tenantName?: string
    useTrashService?: boolean
    moveInDate?: string | null
    occupantCount?: number
    property?: Property
    tenant?: Tenant | null
}

export interface MeterReading {
    id: string
    roomId: string
    period: string // YYYY-MM
    meterStart: number
    meterEnd: number
    recordedAt: string
    recordedBy?: string | null
    createdAt?: string
    updatedAt?: string
}

export interface GlobalSettings {
    id?: string
    appName: string
    costPerKwh: number | string
    trashFee: number | string
    waterFee: number | string
}

export interface RentBill {
    id: string
    roomId: string
    tenantId?: string | null

    // Date-based billing (primary)
    periodStartDate: string // YYYY-MM-DD
    periodEndDate: string // YYYY-MM-DD
    dueDate: string // YYYY-MM-DD
    billingCycleDay?: number | null

    // Legacy fields (for backward compatibility)
    period?: string | null // YYYY-MM
    periodEnd?: string | null

    monthsCovered?: number
    roomPrice: number | string
    waterFee?: number | string
    trashFee?: number | string
    totalAmount: number | string
    isPaid: boolean
    paidAt?: string | null
    generatedAt: string
    tenant?: Tenant | null
    room?: Room
    property?: Property
}

export interface UtilityBill {
    id: string
    roomId: string
    tenantId?: string | null
    period: string // YYYY-MM
    meterStart: number
    meterEnd: number
    costPerKwh: number | string
    usageCost: number | string
    waterFee: number | string
    trashFee: number | string
    additionalCost: number | string
    totalAmount: number | string
    isPaid: boolean
    paidAt?: string | null
    generatedAt: string
    tenant?: Tenant | null
    room?: Room
    property?: Property
}


export interface Tenant {
    id: string
    name: string
    contact: string
    idCardNumber: string
    status: 'active' | 'inactive'
    roomId?: string | null
    assignedRoom?: {
        id: string
        name: string
        propertyId: string
        propertyName: string | null
    } | null
    createdAt?: string
    updatedAt?: string
}

export const useKosStore = defineStore('kos', () => {
    // --- State ---
    // Properties - now fetched from API
    const properties = ref<Property[]>([])
    const propertiesLoading = ref(false)
    const propertiesError = ref<string | null>(null)

    // Rooms - now fetched from API
    const rooms = ref<Room[]>([])
    const roomsLoading = ref(false)
    const roomsError = ref<string | null>(null)
    const roomsMeta = ref<{ page: number; pageSize: number; total: number; totalPages: number }>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

    // Rent Bills - now fetched from API
    const rentBills = ref<RentBill[]>([])
    const rentBillsLoading = ref(false)
    const rentBillsError = ref<string | null>(null)

    // Utility Bills - now fetched from API
    const utilityBills = ref<UtilityBill[]>([])
    const utilityBillsLoading = ref(false)
    const utilityBillsError = ref<string | null>(null)

    // Meter Readings - now fetched from API
    const meterReadings = ref<MeterReading[]>([])
    const meterReadingsLoading = ref(false)
    const meterReadingsError = ref<string | null>(null)

    // Tenants - now fetched from API
    const tenants = ref<Tenant[]>([])
    const tenantsLoading = ref(false)
    const tenantsError = ref<string | null>(null)
    const tenantsMeta = ref<{ page: number; pageSize: number; total: number; totalPages: number }>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

    // Global Settings - now fetched from API
    const settings = ref<GlobalSettings>({
        appName: 'KostMan',
        costPerKwh: 1500,
        trashFee: 25000,
        waterFee: 50000
    })
    const settingsLoading = ref(false)
    const settingsError = ref<string | null>(null)

    // Reminders
    const reminders = ref<{
        overdue: any[];
        dueSoon: any[];
        upcoming: any[];
        counts: { total: number; overdue: number; dueSoon: number };
    }>({ overdue: [], dueSoon: [], upcoming: [], counts: { total: 0, overdue: 0, dueSoon: 0 } })
    const remindersLoading = ref(false)
    const remindersError = ref<string | null>(null)

    // --- Actions ---

    // Settings - API Integration
    async function fetchSettings() {
        settingsLoading.value = true
        settingsError.value = null
        try {
            const data = await $fetch<GlobalSettings>('/api/settings')
            settings.value = {
                id: data.id,
                appName: data.appName || 'KostMan',
                costPerKwh: Number(data.costPerKwh),
                trashFee: Number(data.trashFee),
                waterFee: Number(data.waterFee),
            }
        } catch (err: any) {
            settingsError.value = err?.data?.message || err?.message || 'Failed to fetch settings'
            console.error('fetchSettings error:', err)
        } finally {
            settingsLoading.value = false
        }
    }

    async function saveSettings(updates: Partial<GlobalSettings>) {
        settingsLoading.value = true
        settingsError.value = null
        try {
            const data = await $fetch<GlobalSettings>('/api/settings', {
                method: 'PUT',
                body: updates
            })
            settings.value = {
                id: data.id,
                appName: data.appName || 'KostMan',
                costPerKwh: Number(data.costPerKwh),
                trashFee: Number(data.trashFee),
                waterFee: Number(data.waterFee),
            }
            return data
        } catch (err: any) {
            settingsError.value = err?.data?.message || err?.message || 'Failed to save settings'
            console.error('saveSettings error:', err)
            throw err
        } finally {
            settingsLoading.value = false
        }
    }

    // Integration Settings
    const integrations = ref<Record<string, any>>({})
    const integrationsLoading = ref(false)

    async function fetchIntegrations() {
        integrationsLoading.value = true
        try {
            const data = await $fetch<Record<string, any>>('/api/settings/integrations')
            integrations.value = data
        } catch (err: any) {
            console.error('fetchIntegrations error:', err)
        } finally {
            integrationsLoading.value = false
        }
    }

    async function saveIntegration(provider: string, updates: any) {
        integrationsLoading.value = true
        try {
            const data = await $fetch(`/api/settings/integrations/${provider}`, {
                method: 'PUT',
                body: updates
            })
            integrations.value[provider] = data
            return data
        } catch (err: any) {
            console.error('saveIntegration error:', err)
            throw err
        } finally {
            integrationsLoading.value = false
        }
    }

    // Properties - API Integration
    async function fetchProperties() {
        propertiesLoading.value = true
        propertiesError.value = null
        try {
            const data = await $fetch<Property[]>('/api/properties')
            properties.value = data
        } catch (err: any) {
            propertiesError.value = err?.data?.message || err?.message || 'Failed to fetch properties'
            console.error('fetchProperties error:', err)
        } finally {
            propertiesLoading.value = false
        }
    }

    async function fetchPropertyById(id: string): Promise<Property | null> {
        try {
            const data = await $fetch<Property>(`/api/properties/${id}`)
            return data
        } catch (err: any) {
            console.error('fetchPropertyById error:', err)
            return null
        }
    }

    async function addProperty(property: Omit<Property, 'id'>) {
        propertiesLoading.value = true
        propertiesError.value = null
        try {
            const newProperty = await $fetch<Property>('/api/properties', {
                method: 'POST',
                body: property
            })
            // Fetch the full property with settings
            const fullProperty = await fetchPropertyById(newProperty.id)
            if (fullProperty) {
                properties.value.push(fullProperty)
            } else {
                properties.value.push(newProperty)
            }
            return newProperty
        } catch (err: any) {
            propertiesError.value = err?.data?.message || err?.message || 'Failed to add property'
            console.error('addProperty error:', err)
            throw err
        } finally {
            propertiesLoading.value = false
        }
    }

    async function updateProperty(id: string, updates: Partial<Property> & { mapUrl?: string }) {
        propertiesLoading.value = true
        propertiesError.value = null
        try {
            const updated = await $fetch<Property>(`/api/properties/${id}`, {
                method: 'PUT',
                body: updates
            })
            // Refresh to get full property with settings
            const fullProperty = await fetchPropertyById(id)
            const index = properties.value.findIndex(p => p.id === id)
            if (index !== -1 && fullProperty) {
                properties.value[index] = fullProperty
            } else if (index !== -1) {
                properties.value[index] = { ...properties.value[index], ...updated }
            }
            return updated
        } catch (err: any) {
            propertiesError.value = err?.data?.message || err?.message || 'Failed to update property'
            console.error('updateProperty error:', err)
            throw err
        } finally {
            propertiesLoading.value = false
        }
    }

    async function deleteProperty(id: string) {
        propertiesLoading.value = true
        propertiesError.value = null
        try {
            await $fetch(`/api/properties/${id}`, {
                method: 'DELETE'
            })
            properties.value = properties.value.filter(p => p.id !== id)
            // Also remove rooms of this property from local state
            rooms.value = rooms.value.filter(r => r.propertyId !== id)
        } catch (err: any) {
            propertiesError.value = err?.data?.message || err?.message || 'Failed to delete property'
            console.error('deleteProperty error:', err)
            throw err
        } finally {
            propertiesLoading.value = false
        }
    }

    // Rooms - API Integration
    async function fetchRooms(params?: { propertyId?: string; status?: string; search?: string; page?: number; pageSize?: number; all?: boolean }) {
        roomsLoading.value = true
        roomsError.value = null
        try {
            const query = new URLSearchParams()
            if (params?.all) query.append('all', 'true')
            if (params?.propertyId) query.append('propertyId', params.propertyId)
            if (params?.status) query.append('status', params.status)
            if (params?.search) query.append('search', params.search)
            if (params?.page) query.append('page', params.page.toString())
            if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

            const response = await $fetch<{ data: Room[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/rooms?${query.toString()}`)
            rooms.value = response.data.map(r => ({ ...r, price: Number(r.price) }))
            roomsMeta.value = response.meta
        } catch (err: any) {
            roomsError.value = err?.data?.message || err?.message || 'Failed to fetch rooms'
            console.error('fetchRooms error:', err)
        } finally {
            roomsLoading.value = false
        }
    }

    async function fetchRoomById(id: string): Promise<Room | null> {
        try {
            const data = await $fetch<Room>(`/api/rooms/${id}`)
            return { ...data, price: Number(data.price) }
        } catch (err: any) {
            console.error('fetchRoomById error:', err)
            return null
        }
    }

    async function addRoom(room: Omit<Room, 'id'>) {
        roomsLoading.value = true
        roomsError.value = null
        try {
            const newRoom = await $fetch<Room>('/api/rooms', {
                method: 'POST',
                body: {
                    ...room,
                    price: Number(room.price)
                }
            })
            const roomWithPrice = { ...newRoom, price: Number(newRoom.price) }
            rooms.value.push(roomWithPrice)
            return roomWithPrice
        } catch (err: any) {
            roomsError.value = err?.data?.message || err?.message || 'Failed to add room'
            console.error('addRoom error:', err)
            throw err
        } finally {
            roomsLoading.value = false
        }
    }

    async function updateRoom(id: string, updates: Partial<Room>) {
        roomsLoading.value = true
        roomsError.value = null
        try {
            const payload = {
                ...updates,
                price: updates.price !== undefined ? Number(updates.price) : undefined
            }
            const updated = await $fetch<Room>(`/api/rooms/${id}`, {
                method: 'PUT',
                body: payload
            })

            // Update local store
            const index = rooms.value.findIndex(r => r.id === id)
            if (index !== -1) {
                rooms.value[index] = { ...updated, price: Number(updated.price) }
            }

            // Re-fetch to get complete data with relations (property, tenant, etc.)
            // This ensures room.property and other joined data are available
            const completeRoom = await fetchRoomById(id)
            if (completeRoom && index !== -1) {
                rooms.value[index] = completeRoom
            }

            return updated
        } catch (err: any) {
            roomsError.value = err?.data?.message || err?.message || 'Failed to update room'
            console.error('updateRoom error:', err)
            throw err
        } finally {
            roomsLoading.value = false
        }
    }

    async function deleteRoom(id: string) {
        roomsLoading.value = true
        roomsError.value = null
        try {
            await $fetch(`/api/rooms/${id}`, {
                method: 'DELETE'
            })
            rooms.value = rooms.value.filter(r => r.id !== id)
        } catch (err: any) {
            roomsError.value = err?.data?.message || err?.message || 'Failed to delete room'
            console.error('deleteRoom error:', err)
            throw err
        } finally {
            roomsLoading.value = false
        }
    }

    // ========== RENT BILLS - API Integration ==========
    async function fetchRentBills(params?: { propertyId?: string; isPaid?: boolean; roomId?: string; period?: string }) {
        rentBillsLoading.value = true
        rentBillsError.value = null
        try {
            const query = new URLSearchParams()
            if (params?.propertyId) query.append('propertyId', params.propertyId)
            if (params?.isPaid !== undefined) query.append('isPaid', params.isPaid.toString())
            if (params?.roomId) query.append('roomId', params.roomId)
            if (params?.period) query.append('period', params.period)

            const queryString = query.toString()
            const data = await $fetch<any[]>(`/api/rent-bills${queryString ? '?' + queryString : ''}`)
            rentBills.value = data.map((item: any) => ({
                ...item.bill,
                tenant: item.tenant,
                room: item.room,
                property: item.property
            }))
        } catch (err: any) {
            rentBillsError.value = err?.data?.message || err?.message || 'Failed to fetch rent bills'
            console.error('fetchRentBills error:', err)
        } finally {
            rentBillsLoading.value = false
        }
    }

    async function generateRentBill(data: {
        roomId: string,
        periodStartDate: string, // YYYY-MM-DD
        periodEndDate?: string,
        dueDate?: string,
        monthsCovered?: number,
        roomPrice: number
    }) {
        rentBillsLoading.value = true
        rentBillsError.value = null
        try {
            const newBill = await $fetch<RentBill>('/api/rent-bills/generate', {
                method: 'POST',
                body: data
            })
            rentBills.value.unshift(newBill)
            return newBill
        } catch (err: any) {
            rentBillsError.value = err?.data?.message || err?.message || 'Failed to generate rent bill'
            console.error('generateRentBill error:', err)
            throw err
        } finally {
            rentBillsLoading.value = false
        }
    }

    async function markRentBillAsPaid(id: string) {
        rentBillsLoading.value = true
        rentBillsError.value = null
        try {
            const updatedBill = await $fetch<RentBill>(`/api/rent-bills/${id}/pay`, {
                method: 'PATCH'
            })
            const index = rentBills.value.findIndex(b => b.id === id)
            if (index !== -1) {
                rentBills.value[index] = updatedBill
            }
            return updatedBill
        } catch (err: any) {
            rentBillsError.value = err?.data?.message || err?.message || 'Failed to mark rent bill as paid'
            console.error('markRentBillAsPaid error:', err)
            throw err
        } finally {
            rentBillsLoading.value = false
        }
    }

    async function deleteRentBill(id: string) {
        rentBillsLoading.value = true
        rentBillsError.value = null
        try {
            await $fetch(`/api/rent-bills/${id}`, {
                method: 'DELETE'
            })
            rentBills.value = rentBills.value.filter(b => b.id !== id)
        } catch (err: any) {
            rentBillsError.value = err?.data?.message || err?.message || 'Failed to delete rent bill'
            console.error('deleteRentBill error:', err)
            throw err
        } finally {
            rentBillsLoading.value = false
        }
    }

    // ========== UTILITY BILLS - API Integration ==========
    async function fetchUtilityBills(params?: { propertyId?: string; isPaid?: boolean; roomId?: string; period?: string }) {
        utilityBillsLoading.value = true
        utilityBillsError.value = null
        try {
            const query = new URLSearchParams()
            if (params?.propertyId) query.append('propertyId', params.propertyId)
            if (params?.isPaid !== undefined) query.append('isPaid', params.isPaid.toString())
            if (params?.roomId) query.append('roomId', params.roomId)
            if (params?.period) query.append('period', params.period)

            const queryString = query.toString()
            const data = await $fetch<any[]>(`/api/utility-bills${queryString ? '?' + queryString : ''}`)
            utilityBills.value = data.map((item: any) => ({
                ...item.bill,
                tenant: item.tenant,
                room: item.room,
                property: item.property
            }))
        } catch (err: any) {
            utilityBillsError.value = err?.data?.message || err?.message || 'Failed to fetch utility bills'
            console.error('fetchUtilityBills error:', err)
        } finally {
            utilityBillsLoading.value = false
        }
    }

    async function createUtilityBill(data: {
        roomId: string,
        period: string,
        meterStart: number,
        meterEnd: number,
        costPerKwh: number,
        waterFee: number,
        trashFee: number,
        additionalCost?: number
    }) {
        utilityBillsLoading.value = true
        utilityBillsError.value = null
        try {
            const newBill = await $fetch<UtilityBill>('/api/utility-bills', {
                method: 'POST',
                body: data
            })
            utilityBills.value.unshift(newBill)
            return newBill
        } catch (err: any) {
            utilityBillsError.value = err?.data?.message || err?.message || 'Failed to create utility bill'
            console.error('createUtilityBill error:', err)
            throw err
        } finally {
            utilityBillsLoading.value = false
        }
    }

    async function markUtilityBillAsPaid(id: string) {
        utilityBillsLoading.value = true
        utilityBillsError.value = null
        try {
            const updatedBill = await $fetch<UtilityBill>(`/api/utility-bills/${id}/pay`, {
                method: 'PATCH'
            })
            const index = utilityBills.value.findIndex(b => b.id === id)
            if (index !== -1) {
                utilityBills.value[index] = updatedBill
            }
            return updatedBill
        } catch (err: any) {
            utilityBillsError.value = err?.data?.message || err?.message || 'Failed to mark utility bill as paid'
            console.error('markUtilityBillAsPaid error:', err)
            throw err
        } finally {
            utilityBillsLoading.value = false
        }
    }

    async function deleteUtilityBill(id: string) {
        utilityBillsLoading.value = true
        utilityBillsError.value = null
        try {
            await $fetch(`/api/utility-bills/${id}`, {
                method: 'DELETE'
            })
            utilityBills.value = utilityBills.value.filter(b => b.id !== id)
        } catch (err: any) {
            utilityBillsError.value = err?.data?.message || err?.message || 'Failed to delete utility bill'
            console.error('deleteUtilityBill error:', err)
            throw err
        } finally {
            utilityBillsLoading.value = false
        }
    }


    // Tenants - API Integration
    async function fetchTenants(params?: { status?: 'active' | 'inactive'; search?: string; page?: number; pageSize?: number; all?: boolean }) {
        tenantsLoading.value = true
        tenantsError.value = null
        try {
            const query = new URLSearchParams()
            if (params?.all) query.append('all', 'true')
            if (params?.status) query.append('status', params.status)
            if (params?.search) query.append('search', params.search)
            if (params?.page) query.append('page', params.page.toString())
            if (params?.pageSize) query.append('pageSize', params.pageSize.toString())

            const response = await $fetch<{ data: Tenant[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/tenants?${query.toString()}`)
            tenants.value = response.data
            tenantsMeta.value = response.meta
        } catch (err: any) {
            tenantsError.value = err?.data?.message || err?.message || 'Failed to fetch tenants'
            console.error('fetchTenants error:', err)
        } finally {
            tenantsLoading.value = false
        }
    }

    async function fetchTenantById(id: string): Promise<Tenant | null> {
        try {
            const data = await $fetch<Tenant>(`/api/tenants/${id}`)
            return data
        } catch (err: any) {
            console.error('fetchTenantById error:', err)
            return null
        }
    }

    async function addTenant(tenant: Omit<Tenant, 'id'>) {
        tenantsLoading.value = true
        tenantsError.value = null
        try {
            const newTenant = await $fetch<Tenant>('/api/tenants', {
                method: 'POST',
                body: tenant
            })
            tenants.value.push(newTenant)
            return newTenant
        } catch (err: any) {
            tenantsError.value = err?.data?.message || err?.message || 'Failed to add tenant'
            console.error('addTenant error:', err)
            throw err
        } finally {
            tenantsLoading.value = false
        }
    }

    async function updateTenant(id: string, updates: Partial<Tenant>) {
        tenantsLoading.value = true
        tenantsError.value = null
        try {
            const updated = await $fetch<Tenant>(`/api/tenants/${id}`, {
                method: 'PUT',
                body: updates
            })
            const index = tenants.value.findIndex(t => t.id === id)
            if (index !== -1) {
                tenants.value[index] = { ...tenants.value[index], ...updated }
            }
            return updated
        } catch (err: any) {
            tenantsError.value = err?.data?.message || err?.message || 'Failed to update tenant'
            console.error('updateTenant error:', err)
            throw err
        } finally {
            tenantsLoading.value = false
        }
    }

    async function deleteTenant(id: string) {
        tenantsLoading.value = true
        tenantsError.value = null
        try {
            await $fetch(`/api/tenants/${id}`, {
                method: 'DELETE'
            })
            tenants.value = tenants.value.filter(t => t.id !== id)
        } catch (err: any) {
            tenantsError.value = err?.data?.message || err?.message || 'Failed to delete tenant'
            console.error('deleteTenant error:', err)
            throw err
        } finally {
            tenantsLoading.value = false
        }
    }

    // Meter Readings - API Integration
    async function fetchMeterReadings(roomId?: string) {
        meterReadingsLoading.value = true
        meterReadingsError.value = null
        try {
            const query = roomId ? `?roomId=${roomId}` : ''
            const data = await $fetch<MeterReading[]>(`/api/meter-readings${query}`)
            meterReadings.value = data
        } catch (err: any) {
            meterReadingsError.value = err?.data?.message || err?.message || 'Failed to fetch meter readings'
            console.error('fetchMeterReadings error:', err)
        } finally {
            meterReadingsLoading.value = false
        }
    }

    async function fetchMeterReadingById(id: string): Promise<MeterReading | null> {
        try {
            const data = await $fetch<MeterReading>(`/api/meter-readings/${id}`)
            return data
        } catch (err: any) {
            console.error('fetchMeterReadingById error:', err)
            return null
        }
    }

    async function addMeterReading(reading: Omit<MeterReading, 'id' | 'recordedAt' | 'recorderBy' | 'createdAt' | 'updatedAt'>) {
        meterReadingsLoading.value = true
        meterReadingsError.value = null
        try {
            const newReading = await $fetch<MeterReading>('/api/meter-readings', {
                method: 'POST',
                body: reading
            })
            meterReadings.value.unshift(newReading)

            // Auto-Generate Bills
            try {
                const room = rooms.value.find(r => r.id === reading.roomId)
                if (room) {
                    const property = properties.value.find(p => p.id === room.propertyId)
                    const effectiveSettings = property?.settings || settings.value

                    if (effectiveSettings) {
                        // 1. Create utility bill for this meter reading
                        await createUtilityBill({
                            roomId: reading.roomId,
                            period: reading.period,
                            meterStart: reading.meterStart,
                            meterEnd: reading.meterEnd,
                            costPerKwh: Number(effectiveSettings.costPerKwh),
                            waterFee: Number(effectiveSettings.waterFee),
                            trashFee: room.useTrashService ? Number(effectiveSettings.trashFee) : 0,
                            additionalCost: 0
                        })

                        // 2. Check if rent bill exists for this period, if not create one
                        const existingRentBills = await $fetch<RentBill[]>('/api/rent-bills', {
                            params: { roomId: reading.roomId, period: reading.period }
                        })

                        if (existingRentBills.length === 0) {
                            // No rent bill for this period, create one
                            // Convert period (YYYY-MM) to periodStartDate (YYYY-MM-DD)
                            const periodStartDate = reading.period + '-01'
                            await generateRentBill({
                                roomId: reading.roomId,
                                periodStartDate: periodStartDate,
                                monthsCovered: 1,
                                roomPrice: Number(room.price)
                            })
                        }
                    }
                }
            } catch (e) {
                console.warn('Auto bill creation failed:', e)
            }

            return newReading
        } catch (err: any) {
            meterReadingsError.value = err?.data?.message || err?.message || 'Failed to add meter reading'
            console.error('addMeterReading error:', err)
            throw err
        } finally {
            meterReadingsLoading.value = false
        }
    }

    async function updateMeterReading(id: string, updates: { meterStart?: number; meterEnd?: number }) {
        meterReadingsLoading.value = true
        meterReadingsError.value = null
        try {
            const updatedReading = await $fetch<MeterReading>(`/api/meter-readings/${id}`, {
                method: 'PATCH',
                body: updates
            })
            const index = meterReadings.value.findIndex(r => r.id === id)
            if (index !== -1) {
                meterReadings.value[index] = updatedReading
            }
            return updatedReading
        } catch (err: any) {
            meterReadingsError.value = err?.data?.message || err?.message || 'Failed to update meter reading'
            console.error('updateMeterReading error:', err)
            throw err
        } finally {
            meterReadingsLoading.value = false
        }
    }

    async function deleteMeterReading(id: string) {
        meterReadingsLoading.value = true
        meterReadingsError.value = null
        try {
            await $fetch<MeterReading>(`/api/meter-readings/${id}`, {
                method: 'DELETE' as 'DELETE'
            })
            meterReadings.value = meterReadings.value.filter(r => r.id !== id)
        } catch (err: any) {
            meterReadingsError.value = err?.data?.message || err?.message || 'Failed to delete meter reading'
            console.error('deleteMeterReading error:', err)
            throw err
        } finally {
            meterReadingsLoading.value = false
        }
    }


    // --- Getters ---
    const getPropertyById = computed(() => (id: string) => properties.value.find(p => p.id === id))
    const getRoomsByPropertyId = computed(() => (propertyId: string) => rooms.value.filter(r => r.propertyId === propertyId))
    const getRentBillsByRoomId = computed(() => (roomId: string) => rentBills.value.filter(b => b.roomId === roomId))
    const getUtilityBillsByRoomId = computed(() => (roomId: string) => utilityBills.value.filter(b => b.roomId === roomId))
    const getMeterReadingsByRoomId = computed(() => (roomId: string) =>
        meterReadings.value.filter(r => r.roomId === roomId).sort((a, b) =>
            new Date(b.period).getTime() - new Date(a.period).getTime()
        )
    )
    const getTenantsByStatus = computed(() => (status?: 'active' | 'inactive') =>
        status ? tenants.value.filter(t => t.status === status) : tenants.value
    )


    async function fetchReminders() {
        remindersLoading.value = true
        remindersError.value = null
        try {
            const data = await $fetch<any>('/api/reminders')
            reminders.value = data
        } catch (err: any) {
            remindersError.value = err?.data?.message || err?.message || 'Failed to fetch reminders'
            console.error('fetchReminders error:', err)
        } finally {
            remindersLoading.value = false
        }
    }

    return {
        // State
        properties,
        propertiesLoading,
        propertiesError,
        rooms,
        roomsLoading,
        roomsError,
        roomsMeta,
        // Rent Bills
        rentBills,
        rentBillsLoading,
        rentBillsError,
        // Utility Bills
        utilityBills,
        utilityBillsLoading,
        utilityBillsError,
        // Meter Readings
        meterReadings,
        meterReadingsLoading,
        meterReadingsError,
        tenants,
        tenantsLoading,
        tenantsError,
        tenantsMeta,
        settings,
        settingsLoading,
        settingsError,
        integrations,
        integrationsLoading,
        reminders,
        remindersLoading,
        remindersError,
        // Actions
        fetchSettings,
        saveSettings,
        fetchIntegrations,
        saveIntegration,
        fetchProperties,
        fetchPropertyById,
        addProperty,
        updateProperty,
        deleteProperty,
        fetchRooms,
        fetchRoomById,
        addRoom,
        updateRoom,
        deleteRoom,
        // Rent Bills Actions
        fetchRentBills,
        generateRentBill,
        markRentBillAsPaid,
        deleteRentBill,
        // Utility Bills Actions
        fetchUtilityBills,
        createUtilityBill,
        markUtilityBillAsPaid,
        deleteUtilityBill,
        // Meter Readings Actions
        fetchMeterReadings,
        fetchMeterReadingById,
        addMeterReading,
        updateMeterReading,
        deleteMeterReading,
        fetchTenants,
        fetchTenantById,
        addTenant,
        updateTenant,
        deleteTenant,
        fetchReminders,
        // Getters
        getPropertyById,
        getRoomsByPropertyId,
        getRentBillsByRoomId,
        getUtilityBillsByRoomId,
        getMeterReadingsByRoomId,
        getTenantsByStatus
    }

}, {
    // persist: true - Handled manually
})
