-- Add PIN authentication fields to tenants table
ALTER TABLE "tenants" ADD COLUMN "pin" varchar(255);
ALTER TABLE "tenants" ADD COLUMN "is_default_pin" boolean DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN "pin_changed_at" timestamp;
