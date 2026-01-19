ALTER TABLE "rent_bills" ADD COLUMN "water_fee" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN "trash_fee" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "occupant_count" integer DEFAULT 1;