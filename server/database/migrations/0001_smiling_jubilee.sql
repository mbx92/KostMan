DO $$ BEGIN
 CREATE TYPE "public"."room_status" AS ENUM('available', 'occupied', 'maintenance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tenant_status" AS ENUM('active', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"tenant_id" uuid,
	"period" varchar(7) NOT NULL,
	"period_end" varchar(7),
	"months_covered" integer DEFAULT 1,
	"meter_start" integer NOT NULL,
	"meter_end" integer NOT NULL,
	"cost_per_kwh" numeric(10, 2) NOT NULL,
	"room_price" numeric(12, 2) NOT NULL,
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
CREATE TABLE "global_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"app_name" varchar(255) DEFAULT 'KostMan',
	"cost_per_kwh" numeric(10, 2) DEFAULT '1500',
	"water_fee" numeric(12, 2) DEFAULT '50000',
	"trash_fee" numeric(12, 2) DEFAULT '25000',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "global_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"server_key" varchar(255),
	"client_key" varchar(255),
	"is_production" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "integration_settings_user_id_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"meter_start" integer NOT NULL,
	"meter_end" integer NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"recorder_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "meter_readings_room_id_period_unique" UNIQUE("room_id","period")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar NOT NULL,
	"description" varchar,
	"image" varchar(500),
	"map_url" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"cost_per_kwh" numeric(10, 2) NOT NULL,
	"water_fee" numeric(12, 2) NOT NULL,
	"trash_fee" numeric(12, 2) NOT NULL,
	CONSTRAINT "property_settings_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"tenant_id" uuid,
	"name" varchar(100) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"status" "room_status" DEFAULT 'available',
	"use_trash_service" boolean DEFAULT true,
	"move_in_date" date,
	CONSTRAINT "rooms_property_id_name_unique" UNIQUE("property_id","name")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact" varchar(20) NOT NULL,
	"id_card_number" varchar(16) NOT NULL,
	"status" "tenant_status" DEFAULT 'active'
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_recorder_by_users_id_fk" FOREIGN KEY ("recorder_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_settings" ADD CONSTRAINT "property_settings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;