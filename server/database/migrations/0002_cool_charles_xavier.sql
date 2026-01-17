ALTER TABLE "meter_readings" RENAME COLUMN "recorder_by" TO "recorded_by";--> statement-breakpoint
ALTER TABLE "meter_readings" DROP CONSTRAINT "meter_readings_recorder_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;