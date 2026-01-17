CREATE TABLE "rent_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"tenant_id" uuid,
	"period" varchar(7) NOT NULL,
	"period_end" varchar(7),
	"months_covered" integer DEFAULT 1,
	"room_price" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"is_paid" boolean DEFAULT false,
	"paid_at" timestamp,
	"generated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utility_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"tenant_id" uuid,
	"period" varchar(7) NOT NULL,
	"meter_start" integer NOT NULL,
	"meter_end" integer NOT NULL,
	"cost_per_kwh" numeric(10, 2) NOT NULL,
	"usage_cost" numeric(12, 2) NOT NULL,
	"water_fee" numeric(12, 2) NOT NULL,
	"trash_fee" numeric(12, 2) NOT NULL,
	"additional_cost" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"is_paid" boolean DEFAULT false,
	"paid_at" timestamp,
	"generated_at" timestamp NOT NULL
);
--> statement-breakpoint
DROP TABLE "bills" CASCADE;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD CONSTRAINT "rent_bills_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_bills" ADD CONSTRAINT "rent_bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;