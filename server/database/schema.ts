
import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, boolean, unique, date, integer, index } from 'drizzle-orm/pg-core';

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


// ============================================
// NEW CONSOLIDATED BILLING SYSTEM
// ============================================

// Bill Status Enum
export const billStatusEnum = pgEnum('bill_status', ['draft', 'unpaid', 'paid']);

// Item Type Enum for billing details
export const itemTypeEnum = pgEnum('item_type', ['rent', 'utility', 'others']);

// Payment Method Enum
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'online']);

// Billings - Main consolidated bill record
export const billings = pgTable('billings', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  billingCode: varchar('billing_code', { length: 50 }).notNull().unique(),
  billStatus: billStatusEnum('bill_status').default('draft'),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  monthsCovered: decimal('months_covered', { precision: 5, scale: 2 }).notNull(),
  notes: varchar('notes'),
  totalChargedAmount: decimal('total_charged_amount', { precision: 12, scale: 2 }).notNull(),
  generatedBy: uuid('generated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  roomIdIdx: index('billings_room_id_idx').on(table.roomId),
  tenantIdIdx: index('billings_tenant_id_idx').on(table.tenantId),
  billStatusIdx: index('billings_bill_status_idx').on(table.billStatus),
  periodStartIdx: index('billings_period_start_idx').on(table.periodStart),
  periodEndIdx: index('billings_period_end_idx').on(table.periodEnd),
}));

// Billing Details - Line items for each bill
export const billingDetails = pgTable('billing_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  billId: uuid('bill_id').references(() => billings.id, { onDelete: 'cascade' }).notNull(),
  itemType: itemTypeEnum('item_type').notNull(),
  itemName: varchar('item_name', { length: 100 }).notNull(),
  itemQty: decimal('item_qty', { precision: 10, scale: 2 }).notNull(),
  itemUnitPrice: decimal('item_unit_price', { precision: 12, scale: 2 }).notNull(),
  itemSubAmount: decimal('item_sub_amount', { precision: 12, scale: 2 }).notNull(),
  itemDiscount: decimal('item_discount', { precision: 12, scale: 2 }).default('0'),
  itemTotalAmount: decimal('item_total_amount', { precision: 12, scale: 2 }).notNull(),
  notes: varchar('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Payments - Payment tracking for bills
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  billId: uuid('bill_id').references(() => billings.id).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentAmount: decimal('payment_amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  paymentProof: varchar('payment_proof', { length: 255 }),
  processedBy: uuid('processed_by').references(() => users.id),
  notes: varchar('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// ============================================
// OLD BILLING TABLES (DEPRECATED - Keep for migration)
// ============================================

// Rent Bills - Fixed monthly rental charges (DEPRECATED)
export const rentBills = pgTable('rent_bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  period: varchar('period', { length: 7 }).notNull(), // YYYY-MM (start period)
  periodEnd: varchar('period_end', { length: 7 }), // For multi-month payments
  monthsCovered: integer('months_covered').default(1),
  roomPrice: decimal('room_price', { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').default(false),
  paidAt: timestamp('paid_at'),
  generatedAt: timestamp('generated_at').notNull(),
});

// Utility Bills - Variable charges based on meter readings (DEPRECATED)
export const utilityBills = pgTable('utility_bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  period: varchar('period', { length: 7 }).notNull(), // YYYY-MM
  meterStart: integer('meter_start').notNull(),
  meterEnd: integer('meter_end').notNull(),
  costPerKwh: decimal('cost_per_kwh', { precision: 10, scale: 2 }).notNull(),
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
  recordedBy: uuid('recorded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  unq: unique().on(t.roomId, t.period),
}));

// Global application settings (singleton table - one row per user/owner)
export const globalSettings = pgTable('global_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(), // One settings per user
  appName: varchar('app_name', { length: 255 }).default('KostMan'),
  costPerKwh: decimal('cost_per_kwh', { precision: 10, scale: 2 }).default('1500'),
  waterFee: decimal('water_fee', { precision: 12, scale: 2 }).default('50000'),
  trashFee: decimal('trash_fee', { precision: 12, scale: 2 }).default('25000'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Integration settings for payment gateways (e.g., Midtrans)
export const integrationSettings = pgTable('integration_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'midtrans', 'xendit', etc.
  isEnabled: boolean('is_enabled').default(false),
  serverKey: varchar('server_key', { length: 255 }),
  clientKey: varchar('client_key', { length: 255 }),
  isProduction: boolean('is_production').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  unq: unique().on(t.userId, t.provider), // One config per provider per user
}));

