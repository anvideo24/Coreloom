CREATE TYPE "public"."billing_recurring_interval" AS ENUM('monthly');--> statement-breakpoint
ALTER TYPE "public"."billing_kind" ADD VALUE 'recurring';--> statement-breakpoint
CREATE TABLE "billing_recurring_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"project_id" uuid,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"interval" "billing_recurring_interval" DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"due_offset_days" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "billings" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_recurring_series" ADD CONSTRAINT "billing_recurring_series_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_recurring_series" ADD CONSTRAINT "billing_recurring_series_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_recurring_series" ADD CONSTRAINT "billing_recurring_series_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_recurring_series" ADD CONSTRAINT "billing_recurring_series_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_recurring_series_workspace_start_idx" ON "billing_recurring_series" USING btree ("workspace_id","start_date");--> statement-breakpoint
CREATE INDEX "billing_recurring_series_contract_created_at_idx" ON "billing_recurring_series" USING btree ("contract_id","created_at" desc);--> statement-breakpoint
ALTER TABLE "billings" ADD CONSTRAINT "billings_series_id_billing_recurring_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."billing_recurring_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billings_series_billing_date_idx" ON "billings" USING btree ("series_id","billing_date");