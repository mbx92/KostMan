CREATE TABLE "room_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"cost_per_kwh" numeric(10, 2) NOT NULL,
	"water_fee" numeric(12, 2) NOT NULL,
	"trash_fee" numeric(12, 2) NOT NULL,
	CONSTRAINT "room_settings_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;