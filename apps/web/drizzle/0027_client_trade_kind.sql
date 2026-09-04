CREATE TYPE "public"."client_trade_kind" AS ENUM('sales', 'purchase', 'both');--> statement-breakpoint
ALTER TABLE "client_companies" ADD COLUMN "trade_kind" "client_trade_kind" DEFAULT 'sales' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD COLUMN "supplier_client_company_id" uuid;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_supplier_client_company_id_client_companies_id_fk" FOREIGN KEY ("supplier_client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;
