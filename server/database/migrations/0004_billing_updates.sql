-- Add occupant_count to rooms table
ALTER TABLE "rooms" ADD COLUMN "occupant_count" integer DEFAULT 1;

-- Add water_fee and trash_fee to rent_bills table for multi-month billing
ALTER TABLE "rent_bills" ADD COLUMN "water_fee" numeric(12, 2) DEFAULT '0';
ALTER TABLE "rent_bills" ADD COLUMN "trash_fee" numeric(12, 2) DEFAULT '0';
