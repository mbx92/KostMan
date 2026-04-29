CREATE TYPE "public"."bill_type" AS ENUM('rent', 'utility');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'other';--> statement-breakpoint
CREATE TABLE "payments" (
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
CREATE TABLE "public_invoice_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_invoice_links_code_unique" UNIQUE("code"),
	CONSTRAINT "public_invoice_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "room_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"cost_per_kwh" numeric(10, 2) NOT NULL,
	"water_fee" numeric(12, 2) NOT NULL,
	"trash_fee" numeric(12, 2) NOT NULL,
	CONSTRAINT "room_settings_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
ALTER TABLE "global_settings" ADD COLUMN "whatsapp_detail_fields" text DEFAULT '["property_name","room_name","tenant_name","occupant_count","rent_section","utility_section","grand_total","payment_status"]';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "billing_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "reminder_overdue_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "reminder_due_soon_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "general_whatsapp_template_id" uuid;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN "paid_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "utility_bills" ADD COLUMN "paid_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_billing_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("billing_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_reminder_overdue_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("reminder_overdue_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_reminder_due_soon_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("reminder_due_soon_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_general_whatsapp_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("general_whatsapp_template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_name_idx" ON "properties" USING btree ("name");--> statement-breakpoint
CREATE INDEX "room_name_idx" ON "rooms" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tenant_name_idx" ON "tenants" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tenant_contact_idx" ON "tenants" USING btree ("contact");--> statement-breakpoint
CREATE INDEX "tenant_nik_idx" ON "tenants" USING btree ("id_card_number");