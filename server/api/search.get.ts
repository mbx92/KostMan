import { defineEventHandler, getQuery } from 'h3'
import { db } from '../utils/drizzle'
import { tenants, rooms, properties } from '../database/schema'
import { or, like, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchTerm = (query.q as string || '').trim()
  
  if (!searchTerm || searchTerm.length < 2) {
    return {
      tenants: [],
      rooms: [],
      properties: []
    }
  }
  
  const searchPattern = `%${searchTerm}%`
  
  // Search in parallel
  const [tenantsResult, roomsResult, propertiesResult] = await Promise.all([
    // Search tenants with room and property info
    db.select({
      tenant: tenants,
      room: rooms,
      property: properties
    })
      .from(tenants)
      .leftJoin(rooms, eq(tenants.id, rooms.tenantId))
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(
        or(
          like(tenants.name, searchPattern),
          like(tenants.contact, searchPattern)
        )
      )
      .limit(5),
    
    // Search rooms with property and tenant info
    db.select({
      room: rooms,
      property: properties,
      tenant: tenants
    })
      .from(rooms)
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .leftJoin(tenants, eq(rooms.tenantId, tenants.id))
      .where(like(rooms.name, searchPattern))
      .limit(5),
    
    // Search properties
    db.select()
      .from(properties)
      .where(
        or(
          like(properties.name, searchPattern),
          like(properties.address, searchPattern)
        )
      )
      .limit(5)
  ])
  
  return {
    tenants: tenantsResult.map(t => ({
      id: t.tenant.id,
      name: t.tenant.name,
      phone: t.tenant.contact,
      roomName: t.room?.name,
      propertyName: t.property?.name
    })),
    rooms: roomsResult.map(r => ({
      id: r.room.id,
      name: r.room.name,
      propertyName: r.property?.name,
      tenantName: r.tenant?.name,
      status: r.room.status
    })),
    properties: propertiesResult.map(p => ({
      id: p.id,
      name: p.name,
      address: p.address
    }))
  }
})
