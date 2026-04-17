CREATE TABLE IF NOT EXISTS "public_invoice_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_invoice_links_code_unique" UNIQUE("code"),
	CONSTRAINT "public_invoice_links_token_unique" UNIQUE("token")
);