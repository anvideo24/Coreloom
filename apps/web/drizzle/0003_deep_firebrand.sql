CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"vat_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_versions_quote_version_number_idx" ON "quote_versions" USING btree ("quote_id","version_number");--> statement-breakpoint
CREATE INDEX "quote_versions_quote_created_at_idx" ON "quote_versions" USING btree ("quote_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "quotes_workspace_updated_at_idx" ON "quotes" USING btree ("workspace_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX "quotes_client_company_updated_at_idx" ON "quotes" USING btree ("client_company_id","updated_at" desc);