
import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, boolean } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['owner', 'admin', 'staff']);


export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').default('owner'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});


export const properties = pgTable('properties', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address').notNull(),
  description: varchar('description'),
  image: varchar('image', { length: 500 }),
  mapUrl: varchar('map_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const propertySettings = pgTable('property_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id).notNull().unique(), // One-to-one
  costPerKwh: decimal('cost_per_kwh', { precision: 10, scale: 2 }).notNull(),
  waterFee: decimal('water_fee', { precision: 12, scale: 2 }).notNull(),
  trashFee: decimal('trash_fee', { precision: 12, scale: 2 }).notNull(),
});

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 20 }).notNull(),
  idCardNumber: varchar('id_card_number', { length: 16 }).notNull(),
  status: varchar('status').default('active'), // simpler than enum for now or add enum
});

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  name: varchar('name', { length: 100 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status').default('available'),
});

export const bills = pgTable('bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id).notNull(),
  period: varchar('period', { length: 7 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').default(false),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
