ALTER TABLE "rent_bills" ALTER COLUMN "period" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN "period_start_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN "period_end_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN "due_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD COLUMN "billing_cycle_day" integer;