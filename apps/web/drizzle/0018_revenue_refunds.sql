CREATE TABLE "revenue_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"revenue_entry_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"refunded_on" date NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revenue_refunds" ADD CONSTRAINT "revenue_refunds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_refunds" ADD CONSTRAINT "revenue_refunds_revenue_entry_id_revenue_entries_id_fk" FOREIGN KEY ("revenue_entry_id") REFERENCES "public"."revenue_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revenue_refunds_entry_created_at_idx" ON "revenue_refunds" USING btree ("revenue_entry_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "revenue_refunds_workspace_created_at_idx" ON "revenue_refunds" USING btree ("workspace_id","created_at" desc);