import { relations } from "drizzle-orm/relations";
import { users, globalSettings, integrationSettings, properties, rooms, tenants, meterReadings, propertySettings, utilityBills, rentBills } from "./schema";

export const globalSettingsRelations = relations(globalSettings, ({one}) => ({
	user: one(users, {
		fields: [globalSettings.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	globalSettings: many(globalSettings),
	integrationSettings: many(integrationSettings),
	meterReadings: many(meterReadings),
	properties: many(properties),
}));

export const integrationSettingsRelations = relations(integrationSettings, ({one}) => ({
	user: one(users, {
		fields: [integrationSettings.userId],
		references: [users.id]
	}),
}));

export const roomsRelations = relations(rooms, ({one, many}) => ({
	property: one(properties, {
		fields: [rooms.propertyId],
		references: [properties.id]
	}),
	tenant: one(tenants, {
		fields: [rooms.tenantId],
		references: [tenants.id]
	}),
	meterReadings: many(meterReadings),
	utilityBills: many(utilityBills),
	rentBills: many(rentBills),
}));

export const propertiesRelations = relations(properties, ({one, many}) => ({
	rooms: many(rooms),
	user: one(users, {
		fields: [properties.userId],
		references: [users.id]
	}),
	propertySettings: many(propertySettings),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	rooms: many(rooms),
	utilityBills: many(utilityBills),
	rentBills: many(rentBills),
}));

export const meterReadingsRelations = relations(meterReadings, ({one}) => ({
	room: one(rooms, {
		fields: [meterReadings.roomId],
		references: [rooms.id]
	}),
	user: one(users, {
		fields: [meterReadings.recordedBy],
		references: [users.id]
	}),
}));

export const propertySettingsRelations = relations(propertySettings, ({one}) => ({
	property: one(properties, {
		fields: [propertySettings.propertyId],
		references: [properties.id]
	}),
}));

export const utilityBillsRelations = relations(utilityBills, ({one}) => ({
	room: one(rooms, {
		fields: [utilityBills.roomId],
		references: [rooms.id]
	}),
	tenant: one(tenants, {
		fields: [utilityBills.tenantId],
		references: [tenants.id]
	}),
}));

export const rentBillsRelations = relations(rentBills, ({one}) => ({
	room: one(rooms, {
		fields: [rentBills.roomId],
		references: [rooms.id]
	}),
	tenant: one(tenants, {
		fields: [rentBills.tenantId],
		references: [tenants.id]
	}),
}));