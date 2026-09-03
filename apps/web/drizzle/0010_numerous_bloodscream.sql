CREATE TYPE "public"."ai_proposal_kind" AS ENUM('agreement', 'next_action', 'risk');--> statement-breakpoint
CREATE TYPE "public"."ai_proposal_status" AS ENUM('proposed', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "ai_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"kind" "ai_proposal_kind" NOT NULL,
	"body" text NOT NULL,
	"status" "ai_proposal_status" DEFAULT 'proposed' NOT NULL,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_evidence_id_recho_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."recho_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_proposals_workspace_created_at_idx" ON "ai_proposals" USING btree ("workspace_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "ai_proposals_evidence_created_at_idx" ON "ai_proposals" USING btree ("evidence_id","created_at" desc);