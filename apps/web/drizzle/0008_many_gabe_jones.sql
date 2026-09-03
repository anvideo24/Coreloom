CREATE TYPE "public"."client_contact_relation_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"relation_status" "client_contact_relation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_company_id_client_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."client_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_client_created_at_idx" ON "client_contacts" USING btree ("client_company_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "client_contacts_workspace_updated_at_idx" ON "client_contacts" USING btree ("workspace_id","updated_at" desc);