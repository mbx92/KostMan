DO $$ BEGIN
	CREATE TYPE "public"."bill_type" AS ENUM('rent', 'utility');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'cancelled');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'other';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"bill_type" "bill_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_date" timestamp NOT NULL,
	"status" "payment_status" DEFAULT 'completed',
	"notes" text,
	"recorded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_invoice_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_invoice_links_code_unique" UNIQUE("code"),
	CONSTRAINT "public_invoice_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "room_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"cost_per_kwh" numeric(10, 2) NOT NULL,
	"water_fee" numeric(12, 2) NOT NULL,
	"trash_fee" numeric(12, 2) NOT NULL,
	CONSTRAINT "room_settings_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "whatsapp_detail_fields" text DEFAULT '["property_name","room_name","tenant_name","occupant_count","rent_section","utility_section","grand_total","payment_status"]';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "billing_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "reminder_overdue_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "reminder_due_soon_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "general_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "user_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "utility_bills" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "properties" ADD CONSTRAINT "properties_billing_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("billing_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "properties" ADD CONSTRAINT "properties_reminder_overdue_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("reminder_overdue_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "properties" ADD CONSTRAINT "properties_reminder_due_soon_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("reminder_due_soon_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "properties" ADD CONSTRAINT "properties_general_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("general_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_name_idx" ON "properties" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_name_idx" ON "rooms" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_name_idx" ON "tenants" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_contact_idx" ON "tenants" USING btree ("contact");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_nik_idx" ON "tenants" USING btree ("id_card_number");
