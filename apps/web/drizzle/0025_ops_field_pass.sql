CREATE TYPE "public"."client_tax_type" AS ENUM('general', 'simplified', 'exempt');--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "tax_type" "client_tax_type";--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "account_holder" text;--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "bank_book_ref" text;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD COLUMN "effective_start_on" date;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD COLUMN "effective_end_on" date;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD COLUMN "auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "billings" ADD COLUMN "billing_number" text;--> statement-breakpoint
ALTER TABLE "billings" ADD COLUMN "po_number" text;
