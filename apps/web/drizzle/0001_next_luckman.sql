CREATE TYPE "public"."company_setup_status" AS ENUM('not_started', 'in_progress', 'complete', 'not_applicable');--> statement-breakpoint
CREATE TABLE "company_setup_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"is_conditional" boolean DEFAULT false NOT NULL,
	"source_url" text NOT NULL,
	"status" "company_setup_status" DEFAULT 'not_started' NOT NULL,
	"evidence_reference" text,
	"note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_setup_items" ADD CONSTRAINT "company_setup_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_setup_items_workspace_code_idx" ON "company_setup_items" USING btree ("workspace_id","code");--> statement-breakpoint
CREATE INDEX "company_setup_items_workspace_updated_at_idx" ON "company_setup_items" USING btree ("workspace_id","updated_at" desc);