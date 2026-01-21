import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  decimal,
  boolean,
  unique,
  date,
  integer,
  text,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "staff"]);
export const roomStatusEnum = pgEnum("room_status", [
  "available",
  "occupied",
  "maintenance",
]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "maintenance",
  "utilities",
  "supplies",
  "salary",
  "tax",
  "other",
]);
export const expenseTypeEnum = pgEnum("expense_type", ["property", "global"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "transfer",
  "credit_card",
  "debit_card",
  "e_wallet",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: roleEnum("role").default("owner"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address").notNull(),
  description: varchar("description"),
  image: varchar("image", { length: 500 }),
  mapUrl: varchar("map_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const propertySettings = pgTable("property_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id)
    .notNull()
    .unique(), // One-to-one
  costPerKwh: decimal("cost_per_kwh", { precision: 10, scale: 2 }).notNull(),
  waterFee: decimal("water_fee", { precision: 12, scale: 2 }).notNull(),
  trashFee: decimal("trash_fee", { precision: 12, scale: 2 }).notNull(),
});

export const tenantStatusEnum = pgEnum("tenant_status", ["active", "inactive"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contact: varchar("contact", { length: 20 }).notNull(),
  idCardNumber: varchar("id_card_number", { length: 16 }).notNull(),
  status: tenantStatusEnum("status").default("active"),
  pin: varchar("pin", { length: 255 }), // Hashed PIN
  isDefaultPin: boolean("is_default_pin").default(true),
  pinChangedAt: timestamp("pin_changed_at"),
});

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .references(() => properties.id)
      .notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    name: varchar("name", { length: 100 }).notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    status: roomStatusEnum("status").default("available"),
    useTrashService: boolean("use_trash_service").default(true),
    moveInDate: date("move_in_date"),
    occupantCount: integer("occupant_count").default(1),
  },
  (t) => ({
    unq: unique().on(t.propertyId, t.name),
  }),
);

// Rent Bills - Fixed monthly rental charges
export const rentBills = pgTable("rent_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id),

  // Date-based billing (primary)
  periodStartDate: date("period_start_date").notNull(),
  periodEndDate: date("period_end_date").notNull(),
  dueDate: date("due_date").notNull(),
  billingCycleDay: integer("billing_cycle_day"), // Day of month from moveInDate (1-31)

  // Legacy fields (for backward compatibility & reporting)
  period: varchar("period", { length: 7 }), // YYYY-MM (nullable now)
  periodEnd: varchar("period_end", { length: 7 }), // For multi-month payments

  monthsCovered: integer("months_covered").default(1),
  roomPrice: decimal("room_price", { precision: 12, scale: 2 }).notNull(),
  waterFee: decimal("water_fee", { precision: 12, scale: 2 }).default("0"),
  trashFee: decimal("trash_fee", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paymentMethod: paymentMethodEnum("payment_method"),
  paidAt: timestamp("paid_at"),
  generatedAt: timestamp("generated_at").notNull(),
});

// Utility Bills - Variable charges based on meter readings
export const utilityBills = pgTable("utility_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  meterStart: integer("meter_start").notNull(),
  meterEnd: integer("meter_end").notNull(),
  costPerKwh: decimal("cost_per_kwh", { precision: 10, scale: 2 }).notNull(),
  usageCost: decimal("usage_cost", { precision: 12, scale: 2 }).notNull(),
  waterFee: decimal("water_fee", { precision: 12, scale: 2 }).notNull(),
  trashFee: decimal("trash_fee", { precision: 12, scale: 2 }).notNull(),
  additionalCost: decimal("additional_cost", {
    precision: 12,
    scale: 2,
  }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paymentMethod: paymentMethodEnum("payment_method"),
  paidAt: timestamp("paid_at"),
  generatedAt: timestamp("generated_at").notNull(),
});

export const meterReadings = pgTable(
  "meter_readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .references(() => rooms.id)
      .notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    meterStart: integer("meter_start").notNull(),
    meterEnd: integer("meter_end").notNull(),
    recordedAt: timestamp("recorded_at").notNull(),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    unq: unique().on(t.roomId, t.period),
  }),
);

// Global application settings (singleton table - one row per user/owner)
export const globalSettings = pgTable("global_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull()
    .unique(), // One settings per user
  appName: varchar("app_name", { length: 255 }).default("KostMan"),
  costPerKwh: decimal("cost_per_kwh", { precision: 10, scale: 2 }).default(
    "1500",
  ),
  waterFee: decimal("water_fee", { precision: 12, scale: 2 }).default("50000"),
  trashFee: decimal("trash_fee", { precision: 12, scale: 2 }).default("25000"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Integration settings for payment gateways (e.g., Midtrans)
export const integrationSettings = pgTable(
  "integration_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    provider: varchar("provider", { length: 50 }).notNull(), // 'midtrans', 'xendit', etc.
    isEnabled: boolean("is_enabled").default(false),
    serverKey: varchar("server_key", { length: 500 }), // Increased for encrypted data (salt:iv:tag:encrypted)
    clientKey: varchar("client_key", { length: 255 }),
    isProduction: boolean("is_production").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    unq: unique().on(t.userId, t.provider), // One config per provider per user
  }),
);

// Expense Categories - Custom categories per user
export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#6366f1"), // hex color for UI
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Expenses - Track all business expenses
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),

  // Expense Details
  category: varchar("category", { length: 50 }).notNull(), // Can be default category or custom category name
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  // Classification
  type: expenseTypeEnum("type").notNull().default("property"), // 'property' or 'global'

  // Date & Payment
  expenseDate: date("expense_date").notNull(), // when expense occurred
  paidDate: date("paid_date"), // when actually paid
  isPaid: boolean("is_paid").notNull().default(false),
  paymentMethod: paymentMethodEnum("payment_method"), // 'cash', 'transfer', etc.

  // Supporting Documents
  receiptUrl: text("receipt_url"), // path to uploaded receipt image/PDF
  notes: text("notes"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Log Level Enum
export const logLevelEnum = pgEnum("log_level", ["debug", "info", "warn", "error"]);

// System Logs - For request/error logging with auto-purge
export const systemLogs = pgTable("system_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  level: logLevelEnum("level").notNull(),
  message: text("message").notNull(),
  method: varchar("method", { length: 10 }),
  path: varchar("path", { length: 500 }),
  statusCode: integer("status_code"),
  duration: integer("duration"), // in milliseconds
  userId: uuid("user_id").references(() => users.id),
  ip: varchar("ip", { length: 45 }), // IPv6 compatible
  userAgent: text("user_agent"),
  context: text("context"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// System Settings - Key-value store for system configuration
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Template Type Enum for WhatsApp messages
export const templateTypeEnum = pgEnum("template_type", ["billing", "reminder_overdue", "reminder_due_soon", "general"]);

// WhatsApp Templates - Message templates for billing reminders
export const whatsappTemplates = pgTable("whatsapp_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  message: text("message").notNull(),
  templateType: templateTypeEnum("template_type").default("general"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
// Backup Type Enum
export const backupTypeEnum = pgEnum("backup_type", ["manual", "scheduled"]);

// Database Backups - Track backup history
export const backups = pgTable("backups", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  size: integer("size").notNull(), // bytes
  type: backupTypeEnum("type").notNull().default("manual"),
  storagePath: varchar("storage_path", { length: 512 }),
  duration: integer("duration"), // milliseconds
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});