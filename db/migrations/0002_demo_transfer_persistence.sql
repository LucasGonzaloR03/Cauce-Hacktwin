ALTER TABLE "users" ALTER COLUMN "demo_balance_minor" SET DEFAULT 50000000;--> statement-breakpoint
UPDATE "users"
SET "demo_balance_minor" = 50000000
WHERE "demo_balance_minor" = 100000 AND "kyc_status" = 'demo';--> statement-breakpoint
CREATE TABLE "demo_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_ars_minor" bigint NOT NULL,
	"balance_after_minor" bigint NOT NULL,
	"destination_code" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_transfers_amount_positive_check" CHECK ("demo_transfers"."amount_ars_minor" > 0)
);--> statement-breakpoint
ALTER TABLE "demo_transfers" ADD CONSTRAINT "demo_transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_transfers_user_created_idx" ON "demo_transfers" USING btree ("user_id", "created_at");