ALTER TABLE "demo_orders" ADD COLUMN "execution_mode" text DEFAULT 'ALERT' NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_orders" ADD COLUMN "auto_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demo_orders" ADD COLUMN "confirm_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_orders" ADD COLUMN "last_observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demo_orders" ADD COLUMN "triggered_rate" numeric(30, 10);--> statement-breakpoint
ALTER TABLE "demo_orders" ADD COLUMN "filled_rate" numeric(30, 10);--> statement-breakpoint
ALTER TABLE "demo_orders" ADD COLUMN "executed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demo_orders" ADD CONSTRAINT "demo_orders_execution_mode_check" CHECK ("demo_orders"."execution_mode" IN ('ALERT', 'AUTO_SIMULATE'));--> statement-breakpoint
ALTER TABLE "demo_orders" ADD CONSTRAINT "demo_orders_auto_consent_check" CHECK ("demo_orders"."execution_mode" <> 'AUTO_SIMULATE' OR "demo_orders"."auto_consent_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "demo_orders" ADD CONSTRAINT "demo_orders_confirm_count_check" CHECK ("demo_orders"."confirm_count" >= 0);