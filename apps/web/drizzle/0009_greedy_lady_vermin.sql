CREATE TYPE "public"."recho_evidence_kind" AS ENUM('email', 'call', 'meeting');--> statement-breakpoint
CREATE TABLE "recho_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"kind" "recho_evidence_kind" NOT NULL,
	"title" text NOT NULL,
	"original_identifier" text NOT NULL,
	"original_url" text,
	"occurred_on" date NOT NULL,
	"occurred_time" text NOT NULL,
	"link_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recho_evidence" ADD CONSTRAINT "recho_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recho_evidence" ADD CONSTRAINT "recho_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recho_evidence" ADD CONSTRAINT "recho_evidence_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recho_evidence_project_original_idx" ON "recho_evidence" USING btree ("project_id","original_identifier");--> statement-breakpoint
CREATE INDEX "recho_evidence_workspace_occurred_on_idx" ON "recho_evidence" USING btree ("workspace_id","occurred_on" desc);