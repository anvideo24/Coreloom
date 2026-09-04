ALTER TABLE "client_companies" ADD COLUMN "business_registration_number" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "representative_name" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "business_item" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "business_registration_ref" text;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "tax_invoice_recipient" boolean DEFAULT false NOT NULL;
