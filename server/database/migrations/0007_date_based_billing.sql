-- Migration: Add date-based billing columns
-- This migration adds periodStartDate, periodEndDate, dueDate, and billingCycleDay columns
-- While preserving existing data by calculating dates from the existing period (YYYY-MM) format

-- Step 1: Add new columns as NULLABLE first
ALTER TABLE rent_bills 
  ADD COLUMN IF NOT EXISTS period_start_date DATE,
  ADD COLUMN IF NOT EXISTS period_end_date DATE,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS billing_cycle_day INTEGER;

-- Step 2: Migrate existing data (calculate dates from period YYYY-MM)
UPDATE rent_bills
SET 
  period_start_date = (period || '-01')::DATE,
  period_end_date = (
    DATE_TRUNC('month', (period || '-01')::DATE) + INTERVAL '1 month' - INTERVAL '1 day'
  )::DATE,
  due_date = (
    DATE_TRUNC('month', (period || '-01')::DATE) + INTERVAL '1 month' - INTERVAL '1 day'
  )::DATE,
  billing_cycle_day = 1
WHERE period_start_date IS NULL AND period IS NOT NULL;

-- Step 3: Make date columns NOT NULL (after data migration)
ALTER TABLE rent_bills 
  ALTER COLUMN period_start_date SET NOT NULL,
  ALTER COLUMN period_end_date SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL;

-- Step 4: Make old period column NULLABLE (for backward compatibility)
ALTER TABLE rent_bills ALTER COLUMN period DROP NOT NULL;
