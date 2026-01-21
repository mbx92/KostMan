-- Add payment system: partial payments support

-- Add new enums
DO $$ BEGIN
  CREATE TYPE "bill_type" AS ENUM('rent', 'utility');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "payment_status" AS ENUM('pending', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add 'other' to payment_method if not exists
DO $$ BEGIN
  ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'other';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add paidAmount column to rentBills
ALTER TABLE "rent_bills" 
ADD COLUMN IF NOT EXISTS "paid_amount" NUMERIC(12, 2) DEFAULT 0;

-- Add paidAmount column to utilityBills
ALTER TABLE "utility_bills" 
ADD COLUMN IF NOT EXISTS "paid_amount" NUMERIC(12, 2) DEFAULT 0;

-- Create payments table
CREATE TABLE IF NOT EXISTS "payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "bill_id" UUID NOT NULL,
  "bill_type" "bill_type" NOT NULL,
  "amount" NUMERIC(12, 2) NOT NULL,
  "payment_method" "payment_method" NOT NULL,
  "payment_date" TIMESTAMP NOT NULL,
  "status" "payment_status" DEFAULT 'completed',
  "notes" TEXT,
  "recorded_by" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "payments_bill_id_idx" ON "payments"("bill_id");
CREATE INDEX IF NOT EXISTS "payments_bill_type_idx" ON "payments"("bill_type");
CREATE INDEX IF NOT EXISTS "payments_payment_date_idx" ON "payments"("payment_date");

-- Update existing paid bills to set paidAmount = totalAmount
UPDATE "rent_bills" 
SET "paid_amount" = "total_amount" 
WHERE "is_paid" = true AND ("paid_amount" IS NULL OR "paid_amount" = 0);

UPDATE "utility_bills" 
SET "paid_amount" = "total_amount" 
WHERE "is_paid" = true AND ("paid_amount" IS NULL OR "paid_amount" = 0);

COMMENT ON TABLE "payments" IS 'Records all payments made for bills, supporting partial payments';
COMMENT ON COLUMN "rent_bills"."paid_amount" IS 'Total amount paid so far (sum of all payments)';
COMMENT ON COLUMN "utility_bills"."paid_amount" IS 'Total amount paid so far (sum of all payments)';
