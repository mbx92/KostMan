import { pgTable, uuid, varchar, unique, timestamp, foreignKey, numeric, boolean, date, integer, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const role = pgEnum("role", ['owner', 'admin', 'staff'])
export const roomStatus = pgEnum("room_status", ['available', 'occupied', 'maintenance'])
export const tenantStatus = pgEnum("tenant_status", ['active', 'inactive'])


export const tenants = pgTable("tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	contact: varchar({ length: 20 }).notNull(),
	idCardNumber: varchar("id_card_number", { length: 16 }).notNull(),
	status: tenantStatus().default('active'),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	role: role().default('owner'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const globalSettings = pgTable("global_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	appName: varchar("app_name", { length: 255 }).default('KostMan'),
	costPerKwh: numeric("cost_per_kwh", { precision: 10, scale:  2 }).default('1500'),
	waterFee: numeric("water_fee", { precision: 12, scale:  2 }).default('50000'),
	trashFee: numeric("trash_fee", { precision: 12, scale:  2 }).default('25000'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "global_settings_user_id_users_id_fk"
		}),
	unique("global_settings_user_id_unique").on(table.userId),
]);

export const integrationSettings = pgTable("integration_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: varchar({ length: 50 }).notNull(),
	isEnabled: boolean("is_enabled").default(false),
	serverKey: varchar("server_key", { length: 255 }),
	clientKey: varchar("client_key", { length: 255 }),
	isProduction: boolean("is_production").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "integration_settings_user_id_users_id_fk"
		}),
	unique("integration_settings_user_id_provider_unique").on(table.userId, table.provider),
]);

export const rooms = pgTable("rooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	propertyId: uuid("property_id").notNull(),
	tenantId: uuid("tenant_id"),
	name: varchar({ length: 100 }).notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	status: roomStatus().default('available'),
	useTrashService: boolean("use_trash_service").default(true),
	moveInDate: date("move_in_date"),
	occupantCount: integer("occupant_count").default(1),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "rooms_property_id_properties_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "rooms_tenant_id_tenants_id_fk"
		}),
	unique("rooms_property_id_name_unique").on(table.propertyId, table.name),
]);

export const meterReadings = pgTable("meter_readings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	period: varchar({ length: 7 }).notNull(),
	meterStart: integer("meter_start").notNull(),
	meterEnd: integer("meter_end").notNull(),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).notNull(),
	recordedBy: uuid("recorded_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "meter_readings_room_id_rooms_id_fk"
		}),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [users.id],
			name: "meter_readings_recorded_by_users_id_fk"
		}),
	unique("meter_readings_room_id_period_unique").on(table.roomId, table.period),
]);

export const properties = pgTable("properties", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	address: varchar().notNull(),
	description: varchar(),
	image: varchar({ length: 500 }),
	mapUrl: varchar("map_url", { length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "properties_user_id_users_id_fk"
		}),
]);

export const propertySettings = pgTable("property_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	propertyId: uuid("property_id").notNull(),
	costPerKwh: numeric("cost_per_kwh", { precision: 10, scale:  2 }).notNull(),
	waterFee: numeric("water_fee", { precision: 12, scale:  2 }).notNull(),
	trashFee: numeric("trash_fee", { precision: 12, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "property_settings_property_id_properties_id_fk"
		}),
	unique("property_settings_property_id_unique").on(table.propertyId),
]);

export const utilityBills = pgTable("utility_bills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	tenantId: uuid("tenant_id"),
	period: varchar({ length: 7 }).notNull(),
	meterStart: integer("meter_start").notNull(),
	meterEnd: integer("meter_end").notNull(),
	costPerKwh: numeric("cost_per_kwh", { precision: 10, scale:  2 }).notNull(),
	usageCost: numeric("usage_cost", { precision: 12, scale:  2 }).notNull(),
	waterFee: numeric("water_fee", { precision: 12, scale:  2 }).notNull(),
	trashFee: numeric("trash_fee", { precision: 12, scale:  2 }).notNull(),
	additionalCost: numeric("additional_cost", { precision: 12, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	isPaid: boolean("is_paid").default(false),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	generatedAt: timestamp("generated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "utility_bills_room_id_rooms_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "utility_bills_tenant_id_tenants_id_fk"
		}),
]);

export const rentBills = pgTable("rent_bills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	tenantId: uuid("tenant_id"),
	period: varchar({ length: 7 }).notNull(),
	periodEnd: varchar("period_end", { length: 7 }),
	monthsCovered: integer("months_covered").default(1),
	roomPrice: numeric("room_price", { precision: 12, scale:  2 }).notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	isPaid: boolean("is_paid").default(false),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	generatedAt: timestamp("generated_at", { mode: 'string' }).notNull(),
	waterFee: numeric("water_fee", { precision: 12, scale:  2 }).default('0'),
	trashFee: numeric("trash_fee", { precision: 12, scale:  2 }).default('0'),
}, (table) => [
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "rent_bills_room_id_rooms_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "rent_bills_tenant_id_tenants_id_fk"
		}),
]);
