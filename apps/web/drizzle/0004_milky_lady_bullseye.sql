CREATE TYPE "public"."quote_email_delivery_status" AS ENUM('pending', 'accepted', 'failed');--> statement-breakpoint
CREATE TABLE "quote_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "quote_email_delivery_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_email_deliveries" ADD CONSTRAINT "quote_email_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_email_deliveries" ADD CONSTRAINT "quote_email_deliveries_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_email_deliveries" ADD CONSTRAINT "quote_email_deliveries_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_email_deliveries_quote_version_created_at_idx" ON "quote_email_deliveries" USING btree ("quote_version_id","created_at" desc);