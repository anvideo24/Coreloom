ALTER TABLE "quote_versions" ADD COLUMN "issued_on" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "valid_until" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "client_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_client_contact_id_client_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."client_contacts"("id") ON DELETE no action ON UPDATE no action;
