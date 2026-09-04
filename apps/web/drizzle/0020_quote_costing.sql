ALTER TABLE "quote_versions" ADD COLUMN "target_margin_percent" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "operating_cost_percent" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "cost_amount" integer DEFAULT 0 NOT NULL;
