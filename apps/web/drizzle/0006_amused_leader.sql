CREATE TYPE "public"."billing_kind" AS ENUM('down_payment', 'interim', 'final');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('scheduled', 'deposited');--> statement-breakpoint
CREATE TABLE "billings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"project_id" uuid,
	"kind" "billing_kind" NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"billing_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "billing_status" DEFAULT 'scheduled' NOT NULL,
	"note" text,
	"deposited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "billings" ADD CONSTRAINT "billings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billings" ADD CONSTRAINT "billings_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billings" ADD CONSTRAINT "billings_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billings" ADD CONSTRAINT "billings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billings_workspace_due_date_idx" ON "billings" USING btree ("workspace_id","due_date");--> statement-breakpoint
CREATE INDEX "billings_contract_created_at_idx" ON "billings" USING btree ("contract_id","created_at" desc);