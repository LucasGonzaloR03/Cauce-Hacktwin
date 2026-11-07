ALTER TABLE "corridors" ALTER COLUMN "from_country_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "corridors" ALTER COLUMN "to_country_code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_used_by_order_id_orders_id_fk" FOREIGN KEY ("used_by_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;