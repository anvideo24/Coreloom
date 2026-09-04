CREATE TABLE "workspace_company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brand_name" text DEFAULT 'coreloom' NOT NULL,
	"legal_name" text,
	"business_registration_number" text,
	"representative_name" text,
	"address" text,
	"email" text,
	"bank_name" text,
	"bank_account" text,
	"account_holder" text,
	"swift" text,
	"signature_src" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "workspace_company_profiles" ADD CONSTRAINT "workspace_company_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_company_profiles_workspace_idx" ON "workspace_company_profiles" USING btree ("workspace_id");
