ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "whatsapp_detail_fields" text;
--> statement-breakpoint
UPDATE "global_settings"
SET "whatsapp_detail_fields" = '["property_name","period","room_name","tenant_name","occupant_count","rent_section","utility_section","grand_total","payment_status"]'
WHERE "whatsapp_detail_fields" IS NULL;
--> statement-breakpoint
ALTER TABLE "global_settings"
ALTER COLUMN "whatsapp_detail_fields" SET DEFAULT '["property_name","period","room_name","tenant_name","occupant_count","rent_section","utility_section","grand_total","payment_status"]';
--> statement-breakpoint
ALTER TABLE "global_settings"
ALTER COLUMN "whatsapp_detail_fields" SET NOT NULL;