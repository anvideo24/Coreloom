CREATE TYPE "public"."contract_execution_method" AS ENUM('stamped_original');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'original_recorded', 'executed');--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"vat_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"execution_method" "contract_execution_method" DEFAULT 'stamped_original' NOT NULL,
	"original_reference" text,
	"note" text,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"project_id" uuid,
	"quote_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_versions_contract_version_number_idx" ON "contract_versions" USING btree ("contract_id","version_number");--> statement-breakpoint
CREATE INDEX "contract_versions_contract_created_at_idx" ON "contract_versions" USING btree ("contract_id","created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_quote_id_idx" ON "contracts" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "contracts_workspace_updated_at_idx" ON "contracts" USING btree ("workspace_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX "contracts_client_company_updated_at_idx" ON "contracts" USING btree ("client_company_id","updated_at" desc);