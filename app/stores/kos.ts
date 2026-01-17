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
    property?: Property
}

export interface MeterReading {
    id: string
    roomId: string
    period: string // YYYY-MM
    meterStart: number
    meterEnd: number
    recordedAt: string
}

export interface GlobalSettings {
    id?: string
    appName: string
    costPerKwh: number | string
    trashFee: number | string
    waterFee: number | string
}

export interface Bill {
    id: string
    roomId: string
    period: string // YYYY-MM
    meterStart: number
    meterEnd: number
    costPerKwh: number
    usageCost: number // calculated
    additionalCost: number // water, wifi, etc.
    totalAmount: number
    isPaid: boolean
    generatedAt: string
}

export interface Tenant {
    id: string
    name: string
    contact: string
    idCardNumber: string
    status: 'active' | 'inactive'
    roomId?: string | null
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
    const roomsMeta = ref<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)

    const bills = useLocalStorage<Bill[]>('kos-man-bills', [
        {
            id: 'b1', roomId: '101', period: '2025-12', meterStart: 1200, meterEnd: 1350, costPerKwh: 1500,
            usageCost: 225000, additionalCost: 75000, totalAmount: 1800000, isPaid: true, generatedAt: '2025-12-25T10:00:00Z'
        },
        {
            id: 'b2', roomId: '201', period: '2025-12', meterStart: 800, meterEnd: 920, costPerKwh: 2000,
            usageCost: 240000, additionalCost: 90000, totalAmount: 1530000, isPaid: true, generatedAt: '2025-12-26T09:00:00Z'
        },
        {
            id: 'b3', roomId: '101', period: '2026-01', meterStart: 1350, meterEnd: 1480, costPerKwh: 1500,
            usageCost: 195000, additionalCost: 75000, totalAmount: 1770000, isPaid: false, generatedAt: '2026-01-25T10:00:00Z'
        }
    ])

    const meterReadings = useLocalStorage<MeterReading[]>('kos-man-meter-readings', [
        { id: 'mr1', roomId: '101', period: '2025-12', meterStart: 1200, meterEnd: 1350, recordedAt: '2025-12-25T10:00:00Z' },
        { id: 'mr2', roomId: '201', period: '2025-12', meterStart: 800, meterEnd: 920, recordedAt: '2025-12-26T09:00:00Z' },
        { id: 'mr3', roomId: '101', period: '2026-01', meterStart: 1350, meterEnd: 1480, recordedAt: '2026-01-25T10:00:00Z' },
        // A partial reading for next month
        { id: 'mr4', roomId: '101', period: '2026-02', meterStart: 1480, meterEnd: 1500, recordedAt: '2026-02-05T08:00:00Z' }
    ])

    // Tenants - now fetched from API
    const tenants = ref<Tenant[]>([])
    const tenantsLoading = ref(false)
    const tenantsError = ref<string | null>(null)

    // Global Settings - now fetched from API
    const settings = ref<GlobalSettings>({
        appName: 'KostMan',
        costPerKwh: 1500,
        trashFee: 25000,
        waterFee: 50000
    })
    const settingsLoading = ref(false)
    const settingsError = ref<string | null>(null)

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
    async function fetchRooms(params?: { propertyId?: string; status?: string; search?: string; page?: number; pageSize?: number }) {
        roomsLoading.value = true
        roomsError.value = null
        try {
            const query = new URLSearchParams()
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
            const index = rooms.value.findIndex(r => r.id === id)
            if (index !== -1) {
                rooms.value[index] = { ...rooms.value[index], ...updated, price: Number(updated.price) }
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

    // Billing
    function generateBill(data: {
        roomId: string,
        period: string,
        meterStart: number,
        meterEnd: number,
        costPerKwh: number,
        additionalCost: number // water, wifi, etc.
    }) {
        const room = rooms.value.find(r => r.id === data.roomId)
        if (!room) throw new Error('Room not found')

        const usage = data.meterEnd - data.meterStart
        const usageCost = usage * data.costPerKwh
        // Total = Room Price + Electricity Usage + Additional
        const totalAmount = Number(room.price) + usageCost + data.additionalCost

        const newBill: Bill = {
            id: Date.now().toString(),
            roomId: data.roomId,
            period: data.period,
            meterStart: data.meterStart,
            meterEnd: data.meterEnd,
            costPerKwh: data.costPerKwh,
            usageCost,
            additionalCost: data.additionalCost,
            totalAmount,
            isPaid: false,
            generatedAt: new Date().toISOString()
        }

        bills.value.unshift(newBill) // Add to top
        return newBill
    }

    function markBillAsPaid(id: string) {
        const bill = bills.value.find(b => b.id === id)
        if (bill) {
            bill.isPaid = true
        }
    }

    function deleteBill(id: string) {
        bills.value = bills.value.filter(b => b.id !== id)
    }

    // Tenants - API Integration
    async function fetchTenants(status?: 'active' | 'inactive') {
        tenantsLoading.value = true
        tenantsError.value = null
        try {
            const query = status ? `?status=${status}` : ''
            const data = await $fetch<Tenant[]>(`/api/tenants${query}`)
            tenants.value = data
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

    // Meter Readings
    function addMeterReading(reading: Omit<MeterReading, 'id' | 'recordedAt'>) {
        const id = Date.now().toString()
        meterReadings.value.unshift({
            ...reading,
            id,
            recordedAt: new Date().toISOString()
        })
    }

    function deleteMeterReading(id: string) {
        meterReadings.value = meterReadings.value.filter(r => r.id !== id)
    }

    // --- Getters ---
    const getPropertyById = computed(() => (id: string) => properties.value.find(p => p.id === id))
    const getRoomsByPropertyId = computed(() => (propertyId: string) => rooms.value.filter(r => r.propertyId === propertyId))
    const getBillsByRoomId = computed(() => (roomId: string) => bills.value.filter(b => b.roomId === roomId))
    const getMeterReadingsByRoomId = computed(() => (roomId: string) =>
        meterReadings.value.filter(r => r.roomId === roomId).sort((a, b) =>
            new Date(b.period).getTime() - new Date(a.period).getTime()
        )
    )


    return {
        // State
        properties,
        propertiesLoading,
        propertiesError,
        rooms,
        roomsLoading,
        roomsError,
        roomsMeta,
        bills,
        meterReadings,
        tenants,
        tenantsLoading,
        tenantsError,
        settings,
        settingsLoading,
        settingsError,
        integrations,
        integrationsLoading,
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
        generateBill,
        markBillAsPaid,
        deleteBill,
        addMeterReading,
        deleteMeterReading,
        fetchTenants,
        fetchTenantById,
        addTenant,
        updateTenant,
        deleteTenant,
        // Getters
        getPropertyById,
        getRoomsByPropertyId,
        getBillsByRoomId,
        getMeterReadingsByRoomId
    }
}, {
    // persist: true - Handled manually
})
