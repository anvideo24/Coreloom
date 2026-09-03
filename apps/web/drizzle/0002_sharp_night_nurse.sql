CREATE TYPE "public"."project_status" AS ENUM('planned', 'active', 'on_hold', 'complete');--> statement-breakpoint
CREATE TABLE "client_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "project_status" DEFAULT 'planned' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_companies_workspace_name_idx" ON "client_companies" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "client_companies_workspace_updated_at_idx" ON "client_companies" USING btree ("workspace_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX "projects_workspace_updated_at_idx" ON "projects" USING btree ("workspace_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX "projects_client_company_updated_at_idx" ON "projects" USING btree ("client_company_id","updated_at" desc);