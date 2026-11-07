CREATE TABLE "demo_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_ars_minor" bigint NOT NULL,
	"target_rate" numeric(30, 10) NOT NULL,
	"reference_rate" numeric(30, 10) NOT NULL,
	"estimated_usdt" numeric(30, 10) NOT NULL,
	"expiration_code" text NOT NULL,
	"status" "order_status" DEFAULT 'ARMED' NOT NULL,
	"is_mock" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"quality" "data_quality" NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "demo_orders_amount_positive_check" CHECK ("demo_orders"."amount_ars_minor" > 0),
	CONSTRAINT "demo_orders_rates_positive_check" CHECK ("demo_orders"."target_rate" > 0 AND "demo_orders"."reference_rate" > 0),
	CONSTRAINT "demo_orders_estimate_positive_check" CHECK ("demo_orders"."estimated_usdt" > 0)
);--> statement-breakpoint
ALTER TABLE "demo_orders" ADD CONSTRAINT "demo_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_orders_user_created_idx" ON "demo_orders" USING btree ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "demo_orders_user_status_idx" ON "demo_orders" USING btree ("user_id", "status");