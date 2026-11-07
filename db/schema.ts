import {
  bigint,
  boolean,
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { DemoTransferRecord } from "../lib/demo-types";

/** Qué quiere hacer el usuario: mandar plata o acumular un activo. */
export const intentEnum = pgEnum("intent", ["SEND", "ACCUMULATE"]);

export const orderStatusEnum = pgEnum("order_status", [
  "DRAFT",
  "ARMED",
  "PAUSED",
  "TRIGGERED",
  "QUOTED",
  "EXECUTING",
  "SETTLED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
]);

/** Ciclo de vida independiente del envío simulado. */
export const transferStatusEnum = pgEnum("transfer_status", [
  "DRAFT",
  "QUOTED",
  "REVIEWED",
  "SUBMITTED_SIMULATED",
  "SETTLED_SIMULATED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
]);

export const assetKindEnum = pgEnum("asset_kind", ["fiat", "crypto"]);

export const dataQualityEnum = pgEnum("data_quality", ["live", "cached", "frozen"]);

export const eventActorEnum = pgEnum("event_actor", ["system", "user", "cron"]);

// --- identidad -------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  locale: text("locale").notNull().default("es-AR"),
  countryCode: text("country_code").notNull().default("AR"),
  currencyPref: text("currency_pref").notNull().default("ARS"),
  email: text("email"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  anonTokenHash: text("anon_token_hash"),
  demoBalanceMinor: bigint("demo_balance_minor", { mode: "number" }).notNull().default(50_000_000),
  kycStatus: text("kyc_status").notNull().default("demo"),
  flags: jsonb("flags").notNull().default({}),
  lastIntent: intentEnum("last_intent").notNull().default("SEND"),
}, (t) => [uniqueIndex("users_email_lower_unique_idx").on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL`)]);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_user_expiry_idx").on(t.userId, t.expiresAt),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull().default("magic_link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash), index("auth_tokens_email_idx").on(t.email)],
);

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull().unique(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => [index("auth_challenges_expiry_idx").on(t.expiresAt)]);

export const passkeyCredentials = pgTable("passkey_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: bigint("counter", { mode: "number" }).notNull().default(0),
  transports: jsonb("transports").$type<string[]>().notNull().default([]),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (t) => [index("passkey_credentials_user_idx").on(t.userId)]);

// --- configuración de corredores ------------------------------------------

export const countries = pgTable("countries", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  locale: text("locale").notNull(),
  currency: text("currency").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
}, (t) => [check("countries_code_length_check", sql`char_length(${t.code}) = 2`)]);

export const assets = pgTable("assets", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  kind: assetKindEnum("kind").notNull(),
  decimals: integer("decimals").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
}, (t) => [check("assets_decimals_range_check", sql`${t.decimals} >= 0 AND ${t.decimals} <= 18`)]);

/**
 * Un corredor es una operación concreta: qué entregás, qué recibís, por qué
 * riel y con qué costo. Agregar un activo o un país es un insert.
 */
export const corridors = pgTable(
  "corridors",
  {
    id: text("id").primaryKey(),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.code),
    /** País de origen y destino. countryCode se conserva como país de operación por compatibilidad. */
    fromCountryCode: text("from_country_code").notNull().references(() => countries.code),
    toCountryCode: text("to_country_code").notNull().references(() => countries.code),
    intent: intentEnum("intent").notNull(),
    fromAsset: text("from_asset")
      .notNull()
      .references(() => assets.code),
    toAsset: text("to_asset")
      .notNull()
      .references(() => assets.code),
    /** Activo que se opera (el que se compra o se vende). */
    assetCode: text("asset_code")
      .notNull()
      .references(() => assets.code),
    /** Moneda en la que se expresa el precio del activo. */
    rateCurrency: text("rate_currency")
      .notNull()
      .references(() => assets.code),
    directionLabel: text("direction_label").notNull(),
    railName: text("rail_name").notNull(),
    railKeyLabel: text("rail_key_label").notNull(),
    feeBps: integer("fee_bps").notNull(),
    feeFixedMinor: bigint("fee_fixed_minor", { mode: "number" }).notNull().default(0),
    spreadBps: integer("spread_bps").notNull(),
    railCostMinor: bigint("rail_cost_minor", { mode: "number" }).notNull().default(0),
    sourceOrder: jsonb("source_order").notNull().default([]),
    quoteTtlSeconds: integer("quote_ttl_seconds").notNull().default(20),
    orderTtlDefaultSeconds: integer("order_ttl_default_seconds").notNull().default(604_800),
    maxSlippageBps: integer("max_slippage_bps").notNull().default(50),
    minAmountMinor: bigint("min_amount_minor", { mode: "number" }).notNull().default(100),
    maxAmountMinor: bigint("max_amount_minor", { mode: "number" }).notNull().default(100_000_000),
    /** Unidades del activo por unidad de la moneda de precio (ej. 1 BTC = 125.400.100 ARS). */
    unitScale: numeric("unit_scale", { precision: 30, scale: 10 }).notNull().default("1"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(100),
  },
  (t) => [
    index("corridors_country_idx").on(t.countryCode, t.enabled),
    index("corridors_route_idx").on(t.fromCountryCode, t.toCountryCode, t.intent, t.enabled),
    check("corridors_bps_nonnegative_check", sql`${t.feeBps} >= 0 AND ${t.spreadBps} >= 0 AND ${t.maxSlippageBps} >= 0`),
    check("corridors_amount_range_check", sql`${t.minAmountMinor} > 0 AND ${t.maxAmountMinor} >= ${t.minAmountMinor}`),
    check("corridors_ttl_positive_check", sql`${t.quoteTtlSeconds} > 0 AND ${t.orderTtlDefaultSeconds} > 0`),
  ],
);

// --- precios ---------------------------------------------------------------

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pair: text("pair").notNull(),
    countryCode: text("country_code").notNull(),
    source: text("source").notNull(),
    bid: numeric("bid", { precision: 30, scale: 10 }),
    ask: numeric("ask", { precision: 30, scale: 10 }),
    last: numeric("last", { precision: 30, scale: 10 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    quality: dataQualityEnum("quality").notNull().default("live"),
    raw: jsonb("raw"),
  },
  (t) => [
    index("price_snapshots_pair_time_idx").on(t.pair, t.fetchedAt),
    index("price_snapshots_country_time_idx").on(t.countryCode, t.fetchedAt),
    check("price_snapshots_rate_positive_check", sql`${t.last} > 0 AND (${t.bid} IS NULL OR ${t.bid} > 0) AND (${t.ask} IS NULL OR ${t.ask} > 0)`),
  ],
);

// --- cotizaciones y órdenes ------------------------------------------------

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    corridorId: text("corridor_id")
      .notNull()
      .references(() => corridors.id),
    countryCode: text("country_code").notNull(),
    intent: intentEnum("intent").notNull(),
    /** Snapshot inmutable de los legs de precio usados para esta cotización. */
    ratePath: jsonb("rate_path").notNull().default([]),
    parameters: jsonb("parameters").notNull().default({}),
    fromAsset: text("from_asset").notNull(),
    toAsset: text("to_asset").notNull(),
    assetCode: text("asset_code").notNull(),
    rateCurrency: text("rate_currency").notNull(),
    sourceRate: numeric("source_rate", { precision: 30, scale: 10 }).notNull(),
    effectiveRate: numeric("effective_rate", { precision: 30, scale: 10 }).notNull(),
    amountInMinor: bigint("amount_in_minor", { mode: "number" }).notNull(),
    amountOutMinor: bigint("amount_out_minor", { mode: "number" }).notNull(),
    feeMinor: bigint("fee_minor", { mode: "number" }).notNull(),
    spreadMinor: bigint("spread_minor", { mode: "number" }).notNull(),
    railCostMinor: bigint("rail_cost_minor", { mode: "number" }).notNull(),
    totalCostMinor: bigint("total_cost_minor", { mode: "number" }).notNull(),
    source: text("source").notNull(),
    quality: dataQualityEnum("quality").notNull().default("live"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedByOrderId: uuid("used_by_order_id").references((): AnyPgColumn => orders.id),
  },
  (t) => [
    uniqueIndex("quotes_used_by_order_idx").on(t.usedByOrderId),
    index("quotes_user_created_idx").on(t.userId, t.issuedAt),
    index("quotes_expiry_idx").on(t.expiresAt),
    check("quotes_amounts_positive_check", sql`${t.amountInMinor} > 0 AND ${t.amountOutMinor} >= 0`),
    check("quotes_rate_positive_check", sql`${t.sourceRate} > 0 AND ${t.effectiveRate} > 0`),
  ],
);

/** Transferencias SEND. El destinatario se guarda como snapshot sintético/redactado. */
export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    corridorId: text("corridor_id").notNull().references(() => corridors.id),
    status: transferStatusEnum("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    recipientSnapshot: jsonb("recipient_snapshot").notNull().default({}),
    payoutRail: text("payout_rail").notNull(),
    payoutReference: text("payout_reference"),
    sandbox: boolean("sandbox").notNull().default(true),
    idempotencyKey: text("idempotency_key").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    traceId: text("trace_id"),
  },
  (t) => [
    uniqueIndex("transfers_user_idempotency_idx").on(t.userId, t.idempotencyKey),
    uniqueIndex("transfers_quote_idx").on(t.quoteId),
    index("transfers_user_created_idx").on(t.userId, t.createdAt),
    index("transfers_status_created_idx").on(t.status, t.createdAt),
    check("transfers_version_positive_check", sql`${t.version} > 0`),
  ],
);

/** Historial de la demo. No representa transferencias reales ni usa los rieles de payout. */
export const demoTransfers = pgTable(
  "demo_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountArsMinor: bigint("amount_ars_minor", { mode: "number" }).notNull(),
    balanceAfterMinor: bigint("balance_after_minor", { mode: "number" }).notNull(),
    destinationCode: text("destination_code").notNull(),
    result: jsonb("result").$type<DemoTransferRecord>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("demo_transfers_user_created_idx").on(t.userId, t.createdAt),
    check("demo_transfers_amount_positive_check", sql`${t.amountArsMinor} > 0`),
  ],
);

export const demoOrders = pgTable(
  "demo_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountArsMinor: bigint("amount_ars_minor", { mode: "number" }).notNull(),
    targetRate: numeric("target_rate", { precision: 30, scale: 10 }).notNull(),
    referenceRate: numeric("reference_rate", { precision: 30, scale: 10 }).notNull(),
    estimatedUsdt: numeric("estimated_usdt", { precision: 30, scale: 10 }).notNull(),
    expirationCode: text("expiration_code").notNull(),
    status: orderStatusEnum("status").notNull().default("ARMED"),
    isMock: boolean("is_mock").notNull().default(false),
    source: text("source").notNull(),
    quality: dataQualityEnum("quality").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("demo_orders_user_created_idx").on(t.userId, t.createdAt),
    index("demo_orders_user_status_idx").on(t.userId, t.status),
    check("demo_orders_amount_positive_check", sql`${t.amountArsMinor} > 0`),
    check("demo_orders_rates_positive_check", sql`${t.targetRate} > 0 AND ${t.referenceRate} > 0`),
    check("demo_orders_estimate_positive_check", sql`${t.estimatedUsdt} > 0`),
  ],
);

/** Auditoría append-only de transiciones del envío. */
export const transferEvents = pgTable(
  "transfer_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id").notNull().references(() => transfers.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    fromStatus: text("from_status"),
    toStatus: transferStatusEnum("to_status").notNull(),
    reasonCode: text("reason_code"),
    message: text("message").notNull(),
    actor: eventActorEnum("actor").notNull().default("system"),
    traceId: text("trace_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("transfer_events_seq_idx").on(t.transferId, t.seq),
    index("transfer_events_transfer_created_idx").on(t.transferId, t.createdAt),
    check("transfer_events_seq_positive_check", sql`${t.seq} > 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => quotes.id),
    corridorId: text("corridor_id")
      .notNull()
      .references(() => corridors.id),
    countryCode: text("country_code").notNull(),
    intent: intentEnum("intent").notNull(),
    fromAsset: text("from_asset").notNull(),
    toAsset: text("to_asset").notNull(),
    assetCode: text("asset_code").notNull(),
    rateCurrency: text("rate_currency").notNull(),
    status: orderStatusEnum("status").notNull().default("ARMED"),
    version: integer("version").notNull().default(1),
    condition: text("condition").notNull().default("rate_lte"),
    targetRate: numeric("target_rate", { precision: 30, scale: 10 }).notNull(),
    referenceRate: numeric("reference_rate", { precision: 30, scale: 10 }).notNull(),
    amountInMinor: bigint("amount_in_minor", { mode: "number" }).notNull(),
    amountOutMinor: bigint("amount_out_minor", { mode: "number" }).notNull(),
    reservedAmountMinor: bigint("reserved_amount_minor", { mode: "number" }).notNull(),
    maxSlippageBps: integer("max_slippage_bps").notNull().default(50),
    slippageRealBps: integer("slippage_real_bps"),
    triggeredRate: numeric("triggered_rate", { precision: 30, scale: 10 }),
    filledRate: numeric("filled_rate", { precision: 30, scale: 10 }),
    savingsMinor: bigint("savings_minor", { mode: "number" }).default(0),
    confirmCount: integer("confirm_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    consentVersion: text("consent_version").notNull().default("1.0"),
    consentTextHash: text("consent_text_hash").notNull(),
    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true }).notNull().defaultNow(),
    traceId: text("trace_id"),
  },
  (t) => [
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_status_idx").on(t.status, t.expiresAt),
    uniqueIndex("orders_idempotency_idx").on(t.userId, t.idempotencyKey),
    check("orders_amounts_positive_check", sql`${t.amountInMinor} > 0 AND ${t.amountOutMinor} > 0 AND ${t.reservedAmountMinor} >= 0`),
    check("orders_version_attempts_check", sql`${t.version} > 0 AND ${t.attempts} >= 0 AND ${t.confirmCount} >= 0`),
    check("orders_rates_positive_check", sql`${t.targetRate} > 0 AND ${t.referenceRate} > 0`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reasonCode: text("reason_code"),
    message: text("message").notNull(),
    rateAtEvent: numeric("rate_at_event", { precision: 30, scale: 10 }),
    quoteId: uuid("quote_id"),
    actor: eventActorEnum("actor").notNull().default("system"),
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("order_events_seq_idx").on(t.orderId, t.seq),
    index("order_events_order_idx").on(t.orderId, t.createdAt),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("idempotency_scope_key_idx").on(t.userId, t.endpoint, t.key),
    index("idempotency_expiry_idx").on(t.expiresAt),
    check("idempotency_status_check", sql`${t.responseStatus} >= 100 AND ${t.responseStatus} <= 599`),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

/** Tipos inferidos para servicios y contratos de persistencia. */
export type Transfer = typeof transfers.$inferSelect;
export type DemoTransfer = typeof demoTransfers.$inferSelect;
export type DemoOrder = typeof demoOrders.$inferSelect;
export type TransferEvent = typeof transferEvents.$inferSelect;
export type TransferStatus = (typeof transferStatusEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Corridor = typeof corridors.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type Intent = (typeof intentEnum.enumValues)[number];
export type DataQuality = (typeof dataQualityEnum.enumValues)[number];
