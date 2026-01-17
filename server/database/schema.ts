
import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, boolean, unique, date, integer } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['owner', 'admin', 'staff']);
export const roomStatusEnum = pgEnum('room_status', ['available', 'occupied', 'maintenance']);

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

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'inactive']);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 20 }).notNull(),
  idCardNumber: varchar('id_card_number', { length: 16 }).notNull(),
  status: tenantStatusEnum('status').default('active'),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  propertyId: uuid('property_id').references(() => properties.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  name: varchar('name', { length: 100 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  status: roomStatusEnum('status').default('available'),
  useTrashService: boolean('use_trash_service').default(true),
  moveInDate: date('move_in_date'),
}, (t) => ({
  unq: unique().on(t.propertyId, t.name),
}));

export const bills = pgTable('bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  period: varchar('period', { length: 7 }).notNull(), // YYYY-MM format
  periodEnd: varchar('period_end', { length: 7 }), // For multi-month payments
  monthsCovered: integer('months_covered').default(1),
  meterStart: integer('meter_start').notNull(),
  meterEnd: integer('meter_end').notNull(),
  costPerKwh: decimal('cost_per_kwh', { precision: 10, scale: 2 }).notNull(),
  roomPrice: decimal('room_price', { precision: 12, scale: 2 }).notNull(),
  usageCost: decimal('usage_cost', { precision: 12, scale: 2 }).notNull(),
  waterFee: decimal('water_fee', { precision: 12, scale: 2 }).notNull(),
  trashFee: decimal('trash_fee', { precision: 12, scale: 2 }).notNull(),
  additionalCost: decimal('additional_cost', { precision: 12, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').default(false),
  paidAt: timestamp('paid_at'),
  generatedAt: timestamp('generated_at').notNull(),
});

export const meterReadings = pgTable('meter_readings', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id).notNull(),
  period: varchar('period', { length: 7 }).notNull(),
  meterStart: integer('meter_start').notNull(),
  meterEnd: integer('meter_end').notNull(),
  recordedAt: timestamp('recorded_at').notNull(),
  recorderBy: uuid('recorder_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  unq: unique().on(t.roomId, t.period),
  // Note: check constraint (meterEnd >= meterStart) is complex in some ORMs, will handle in app code for now or use sql check if possible but staying simple.
}));
