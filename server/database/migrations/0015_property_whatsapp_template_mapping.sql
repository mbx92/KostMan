ALTER TABLE "properties"
ADD COLUMN "billing_whatsapp_template_id" uuid,
ADD COLUMN "reminder_overdue_whatsapp_template_id" uuid,
ADD COLUMN "reminder_due_soon_whatsapp_template_id" uuid,
ADD COLUMN "general_whatsapp_template_id" uuid;

ALTER TABLE "properties"
ADD CONSTRAINT "properties_billing_whatsapp_template_id_whatsapp_templates_id_fk"
FOREIGN KEY ("billing_whatsapp_template_id")
REFERENCES "public"."whatsapp_templates"("id")
ON DELETE set null
ON UPDATE no action;

ALTER TABLE "properties"
ADD CONSTRAINT "properties_reminder_overdue_whatsapp_template_id_whatsapp_templates_id_fk"
FOREIGN KEY ("reminder_overdue_whatsapp_template_id")
REFERENCES "public"."whatsapp_templates"("id")
ON DELETE set null
ON UPDATE no action;

ALTER TABLE "properties"
ADD CONSTRAINT "properties_reminder_due_soon_whatsapp_template_id_whatsapp_templates_id_fk"
FOREIGN KEY ("reminder_due_soon_whatsapp_template_id")
REFERENCES "public"."whatsapp_templates"("id")
ON DELETE set null
ON UPDATE no action;

ALTER TABLE "properties"
ADD CONSTRAINT "properties_general_whatsapp_template_id_whatsapp_templates_id_fk"
FOREIGN KEY ("general_whatsapp_template_id")
REFERENCES "public"."whatsapp_templates"("id")
ON DELETE set null
ON UPDATE no action;