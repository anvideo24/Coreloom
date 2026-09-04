ALTER TABLE "contract_versions" ADD COLUMN "contract_number" text;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD COLUMN "account_category" text;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD COLUMN "account_category" text;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD COLUMN "supplier_name" text;
