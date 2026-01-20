ALTER TABLE "tenants" ADD COLUMN "pin" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_default_pin" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pin_changed_at" timestamp;