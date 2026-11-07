CREATE TYPE "public"."asset_kind" AS ENUM('fiat', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."data_quality" AS ENUM('live', 'cached', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."event_actor" AS ENUM('system', 'user', 'cron');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('SEND', 'ACCUMULATE');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'ARMED', 'PAUSED', 'TRIGGERED', 'QUOTED', 'EXECUTING', 'SETTLED', 'EXPIRED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('DRAFT', 'QUOTED', 'REVIEWED', 'SUBMITTED_SIMULATED', 'SETTLED_SIMULATED', 'EXPIRED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TABLE "assets" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"decimals" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "assets_decimals_range_check" CHECK ("assets"."decimals" >= 0 AND "assets"."decimals" <= 18)
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text DEFAULT 'magic_link' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "corridors" (
	"id" text PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"from_country_code" text DEFAULT 'AR' NOT NULL,
	"to_country_code" text DEFAULT 'AR' NOT NULL,
	"intent" "intent" NOT NULL,
	"from_asset" text NOT NULL,
	"to_asset" text NOT NULL,
	"asset_code" text NOT NULL,
	"rate_currency" text NOT NULL,
	"direction_label" text NOT NULL,
	"rail_name" text NOT NULL,
	"rail_key_label" text NOT NULL,
	"fee_bps" integer NOT NULL,
	"fee_fixed_minor" bigint DEFAULT 0 NOT NULL,
	"spread_bps" integer NOT NULL,
	"rail_cost_minor" bigint DEFAULT 0 NOT NULL,
	"source_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quote_ttl_seconds" integer DEFAULT 20 NOT NULL,
	"order_ttl_default_seconds" integer DEFAULT 604800 NOT NULL,
	"max_slippage_bps" integer DEFAULT 50 NOT NULL,
	"min_amount_minor" bigint DEFAULT 100 NOT NULL,
	"max_amount_minor" bigint DEFAULT 100000000 NOT NULL,
	"unit_scale" numeric(30, 10) DEFAULT '1' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "corridors_bps_nonnegative_check" CHECK ("corridors"."fee_bps" >= 0 AND "corridors"."spread_bps" >= 0 AND "corridors"."max_slippage_bps" >= 0),
	CONSTRAINT "corridors_amount_range_check" CHECK ("corridors"."min_amount_minor" > 0 AND "corridors"."max_amount_minor" >= "corridors"."min_amount_minor"),
	CONSTRAINT "corridors_ttl_positive_check" CHECK ("corridors"."quote_ttl_seconds" > 0 AND "corridors"."order_ttl_default_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"locale" text NOT NULL,
	"currency" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "countries_code_length_check" CHECK (char_length("countries"."code") = 2)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_status_check" CHECK ("idempotency_keys"."response_status" >= 100 AND "idempotency_keys"."response_status" <= 599)
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason_code" text,
	"message" text NOT NULL,
	"rate_at_event" numeric(30, 10),
	"quote_id" uuid,
	"actor" "event_actor" DEFAULT 'system' NOT NULL,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quote_id" uuid,
	"corridor_id" text NOT NULL,
	"country_code" text NOT NULL,
	"intent" "intent" NOT NULL,
	"from_asset" text NOT NULL,
	"to_asset" text NOT NULL,
	"asset_code" text NOT NULL,
	"rate_currency" text NOT NULL,
	"status" "order_status" DEFAULT 'ARMED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"condition" text DEFAULT 'rate_lte' NOT NULL,
	"target_rate" numeric(30, 10) NOT NULL,
	"reference_rate" numeric(30, 10) NOT NULL,
	"amount_in_minor" bigint NOT NULL,
	"amount_out_minor" bigint NOT NULL,
	"reserved_amount_minor" bigint NOT NULL,
	"max_slippage_bps" integer DEFAULT 50 NOT NULL,
	"slippage_real_bps" integer,
	"triggered_rate" numeric(30, 10),
	"filled_rate" numeric(30, 10),
	"savings_minor" bigint DEFAULT 0,
	"confirm_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"failure_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"consent_version" text DEFAULT '1.0' NOT NULL,
	"consent_text_hash" text NOT NULL,
	"consent_accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trace_id" text,
	CONSTRAINT "orders_amounts_positive_check" CHECK ("orders"."amount_in_minor" > 0 AND "orders"."amount_out_minor" > 0 AND "orders"."reserved_amount_minor" >= 0),
	CONSTRAINT "orders_version_attempts_check" CHECK ("orders"."version" > 0 AND "orders"."attempts" >= 0 AND "orders"."confirm_count" >= 0),
	CONSTRAINT "orders_rates_positive_check" CHECK ("orders"."target_rate" > 0 AND "orders"."reference_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair" text NOT NULL,
	"country_code" text NOT NULL,
	"source" text NOT NULL,
	"bid" numeric(30, 10),
	"ask" numeric(30, 10),
	"last" numeric(30, 10) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quality" "data_quality" DEFAULT 'live' NOT NULL,
	"raw" jsonb,
	CONSTRAINT "price_snapshots_rate_positive_check" CHECK ("price_snapshots"."last" > 0 AND ("price_snapshots"."bid" IS NULL OR "price_snapshots"."bid" > 0) AND ("price_snapshots"."ask" IS NULL OR "price_snapshots"."ask" > 0))
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"corridor_id" text NOT NULL,
	"country_code" text NOT NULL,
	"intent" "intent" NOT NULL,
	"rate_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"from_asset" text NOT NULL,
	"to_asset" text NOT NULL,
	"asset_code" text NOT NULL,
	"rate_currency" text NOT NULL,
	"source_rate" numeric(30, 10) NOT NULL,
	"effective_rate" numeric(30, 10) NOT NULL,
	"amount_in_minor" bigint NOT NULL,
	"amount_out_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"spread_minor" bigint NOT NULL,
	"rail_cost_minor" bigint NOT NULL,
	"total_cost_minor" bigint NOT NULL,
	"source" text NOT NULL,
	"quality" "data_quality" DEFAULT 'live' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by_order_id" uuid,
	CONSTRAINT "quotes_amounts_positive_check" CHECK ("quotes"."amount_in_minor" > 0 AND "quotes"."amount_out_minor" >= 0),
	CONSTRAINT "quotes_rate_positive_check" CHECK ("quotes"."source_rate" > 0 AND "quotes"."effective_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"from_status" text,
	"to_status" "transfer_status" NOT NULL,
	"reason_code" text,
	"message" text NOT NULL,
	"actor" "event_actor" DEFAULT 'system' NOT NULL,
	"trace_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_events_seq_positive_check" CHECK ("transfer_events"."seq" > 0)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"corridor_id" text NOT NULL,
	"status" "transfer_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"recipient_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payout_rail" text NOT NULL,
	"payout_reference" text,
	"sandbox" boolean DEFAULT true NOT NULL,
	"idempotency_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	"failure_reason" text,
	"trace_id" text,
	CONSTRAINT "transfers_version_positive_check" CHECK ("transfers"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" text DEFAULT 'es-AR' NOT NULL,
	"country_code" text DEFAULT 'AR' NOT NULL,
	"currency_pref" text DEFAULT 'ARS' NOT NULL,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"anon_token_hash" text,
	"demo_balance_minor" bigint DEFAULT 100000 NOT NULL,
	"kyc_status" text DEFAULT 'demo' NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_intent" "intent" DEFAULT 'SEND' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_from_country_code_countries_code_fk" FOREIGN KEY ("from_country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_to_country_code_countries_code_fk" FOREIGN KEY ("to_country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_from_asset_assets_code_fk" FOREIGN KEY ("from_asset") REFERENCES "public"."assets"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_to_asset_assets_code_fk" FOREIGN KEY ("to_asset") REFERENCES "public"."assets"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_asset_code_assets_code_fk" FOREIGN KEY ("asset_code") REFERENCES "public"."assets"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_rate_currency_assets_code_fk" FOREIGN KEY ("rate_currency") REFERENCES "public"."assets"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_corridor_id_corridors_id_fk" FOREIGN KEY ("corridor_id") REFERENCES "public"."corridors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_idx" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_email_idx" ON "auth_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "corridors_country_idx" ON "corridors" USING btree ("country_code","enabled");--> statement-breakpoint
CREATE INDEX "corridors_route_idx" ON "corridors" USING btree ("from_country_code","to_country_code","intent","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_scope_key_idx" ON "idempotency_keys" USING btree ("user_id","endpoint","key");--> statement-breakpoint
CREATE INDEX "idempotency_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_events_seq_idx" ON "order_events" USING btree ("order_id","seq");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_idx" ON "orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "price_snapshots_pair_time_idx" ON "price_snapshots" USING btree ("pair","fetched_at");--> statement-breakpoint
CREATE INDEX "price_snapshots_country_time_idx" ON "price_snapshots" USING btree ("country_code","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_used_by_order_idx" ON "quotes" USING btree ("used_by_order_id");--> statement-breakpoint
CREATE INDEX "quotes_user_created_idx" ON "quotes" USING btree ("user_id","issued_at");--> statement-breakpoint
CREATE INDEX "quotes_expiry_idx" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_expiry_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_events_seq_idx" ON "transfer_events" USING btree ("transfer_id","seq");--> statement-breakpoint
CREATE INDEX "transfer_events_transfer_created_idx" ON "transfer_events" USING btree ("transfer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_user_idempotency_idx" ON "transfers" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_quote_idx" ON "transfers" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "transfers_user_created_idx" ON "transfers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transfers_status_created_idx" ON "transfers" USING btree ("status","created_at");