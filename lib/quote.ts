import "server-only";
import { db } from "@/db";
import { quotes, type Corridor, type Quote } from "@/db/schema";
import { getTick, pairFor, type RateTick } from "./fx";
import {
  ASSET_META,
  applyBps,
  assetMeta,
  convertMinor,
  fromMinor,
  toScaled,
} from "./money";
import { ProblemError } from "./problem";

export type CostLine = { key: string; label: string; amountMinor: number; asset: string; note?: string };

export type ComparisonItem = {
  id: string;
  label: string;
  bps: number;
  rate?: string;
  best?: boolean;
  note?: string;
};

export type QuoteComputation = {
  sourceRate: string;
  effectiveRate: string;
  amountInMinor: number;
  amountOutMinor: number;
  feeMinor: number;
  spreadMinor: number;
  railCostMinor: number;
  totalCostMinor: number;
  totalCostBps: number;
  lines: CostLine[];
};

const TARJETA_TTL_MS = 5 * 60 * 1000;
let tarjetaCache: { at: number; venta: number } | null = null;

async function getTarjetaRate(): Promise<number | null> {
  if (tarjetaCache && Date.now() - tarjetaCache.at < TARJETA_TTL_MS) return tarjetaCache.venta;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_500);
    const res = await fetch("https://dolarapi.com/v1/dolares/tarjeta", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { venta?: number };
    if (!json.venta) return null;
    tarjetaCache = { at: Date.now(), venta: json.venta };
    return json.venta;
  } catch {
    return null;
  }
}

/**
 * Un corredor compra el activo cuando la moneda de precio es la que entrega
 * (ARS → BTC) y lo vende cuando la moneda de precio es la que recibe
 * (USD → ARS).
 */
export function isBuy(corridor: Corridor): boolean {
  return corridor.fromAsset === corridor.rateCurrency;
}

export function computeQuote(corridor: Corridor, tick: RateTick, amountInMinor: number): QuoteComputation {
  const market = Number(tick.last);
  if (!Number.isFinite(market) || market <= 0) {
    throw new ProblemError("UPSTREAM_UNAVAILABLE", "El precio recibido no es válido.");
  }

  const fromMeta = assetMeta(corridor.fromAsset);
  const toMeta = assetMeta(corridor.toAsset);
  const buy = isBuy(corridor);
  const spreadFactor = corridor.spreadBps / 10_000;
  const effective = buy ? market * (1 + spreadFactor) : market * (1 - spreadFactor);

  const feeMinor = applyBps(amountInMinor, corridor.feeBps) + corridor.feeFixedMinor;
  const spreadMinor = applyBps(amountInMinor, corridor.spreadBps);
  const railCostMinor = corridor.railCostMinor;
  const totalCostMinor = feeMinor + spreadMinor + railCostMinor;

  if (amountInMinor - totalCostMinor <= 0) {
    throw new ProblemError("LIMIT_EXCEEDED", "El monto no cubre los costos de la operación.");
  }

  const rateToUse = buy ? 1 / effective : effective;
  const grossOut = convertMinor(amountInMinor, fromMeta.storageDecimals, toMeta.storageDecimals, String(market));
  const costOut = convertMinor(totalCostMinor, fromMeta.storageDecimals, toMeta.storageDecimals, String(market));
  const amountOutMinor = Math.max(0, grossOut - costOut);

  return {
    sourceRate: String(market),
    effectiveRate: String(buy ? effective : effective),
    amountInMinor,
    amountOutMinor,
    feeMinor,
    spreadMinor,
    railCostMinor,
    totalCostMinor,
    totalCostBps: amountInMinor > 0 ? Math.round((totalCostMinor / amountInMinor) * 10_000) : 0,
    lines: [
      { key: "fee", label: "Comisión", amountMinor: feeMinor, asset: corridor.fromAsset },
      {
        key: "spread",
        label: `Spread (${(corridor.spreadBps / 100).toFixed(2).replace(".", ",")}%)`,
        amountMinor: spreadMinor,
        asset: corridor.fromAsset,
      },
      {
        key: "rail",
        label: `Riel ${corridor.railName}`,
        amountMinor: railCostMinor,
        asset: corridor.fromAsset,
        note: railCostMinor === 0 ? "incluido" : undefined,
      },
    ],
  };
}

export async function createQuote(params: {
  userId: string;
  corridor: Corridor;
  amountInMinor: number;
  locale?: string;
}): Promise<Quote> {
  const { userId, corridor, amountInMinor } = params;

  if (!Number.isInteger(amountInMinor) || amountInMinor <= 0) {
    throw new ProblemError("BAD_REQUEST", "El monto tiene que ser un entero positivo en unidades mínimas.");
  }
  if (amountInMinor < corridor.minAmountMinor || amountInMinor > corridor.maxAmountMinor) {
    throw new ProblemError("LIMIT_EXCEEDED", "El monto está fuera del rango permitido para este corredor.", {
      min_amount_minor: corridor.minAmountMinor,
      max_amount_minor: corridor.maxAmountMinor,
    });
  }

  const pair = pairFor(corridor.assetCode, corridor.rateCurrency);
  const tick = await getTick(pair);
  const computation = computeQuote(corridor, tick, amountInMinor);
  const expiresAt = new Date(Date.now() + corridor.quoteTtlSeconds * 1000);

  const [quote] = await db
    .insert(quotes)
    .values({
      userId,
      corridorId: corridor.id,
      countryCode: corridor.countryCode,
      intent: corridor.intent,
      fromAsset: corridor.fromAsset,
      toAsset: corridor.toAsset,
      assetCode: corridor.assetCode,
      rateCurrency: corridor.rateCurrency,
      sourceRate: computation.sourceRate,
      effectiveRate: computation.effectiveRate,
      amountInMinor,
      amountOutMinor: computation.amountOutMinor,
      feeMinor: computation.feeMinor,
      spreadMinor: computation.spreadMinor,
      railCostMinor: computation.railCostMinor,
      totalCostMinor: computation.totalCostMinor,
      source: tick.source,
      quality: tick.quality,
      expiresAt,
    })
    .returning();

  return quote;
}

export async function getComparisons(corridor: Corridor, quote: Quote): Promise<ComparisonItem[]> {
  const items: ComparisonItem[] = [
    {
      id: "cauce",
      label: corridor.railName,
      bps: Math.round((quote.totalCostMinor / quote.amountInMinor) * 10_000),
      rate: quote.effectiveRate,
      best: true,
    },
  ];

  if (corridor.countryCode !== "AR" || corridor.rateCurrency !== "ARS") return items;

  const mep = await getTick("USD/ARS").catch(() => null);
  const mepRate = mep ? Number(mep.last) : null;

  const tarjeta = await getTarjetaRate();
  if (tarjeta && mepRate) {
    items.push({
      id: "tarjeta",
      label: "Tarjeta",
      bps: Math.round((tarjeta / mepRate - 1) * 10_000),
      rate: String(tarjeta),
      note: "sobrecosto vs. MEP",
    });
  }

  items.push({ id: "banco", label: "Banco", bps: 1_499, note: "costo publicado" });

  const usdt = await getTick("USDT/ARS").catch(() => null);
  if (usdt && mepRate) {
    items.push({
      id: "usdt",
      label: "USDT",
      bps: Math.round((Number(usdt.last) / mepRate - 1) * 10_000),
      rate: usdt.last,
      note: "dólar cripto vs. MEP",
    });
  }

  return items;
}

export function quoteSecondsRemaining(quote: Pick<Quote, "expiresAt">): number {
  return Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
}

export function quoteIsExpired(quote: Pick<Quote, "expiresAt">): boolean {
  return new Date(quote.expiresAt).getTime() <= Date.now();
}

export function quoteView(quote: Quote, corridor: Corridor, comparisons: ComparisonItem[] = []) {
  return {
    id: quote.id,
    corridor_id: quote.corridorId,
    country_code: quote.countryCode,
    intent: quote.intent,
    from_asset: quote.fromAsset,
    to_asset: quote.toAsset,
    asset_code: quote.assetCode,
    rate_currency: quote.rateCurrency,
    source_rate: quote.sourceRate,
    effective_rate: quote.effectiveRate,
    amount_in_minor: quote.amountInMinor,
    amount_out_minor: quote.amountOutMinor,
    fee_minor: quote.feeMinor,
    spread_minor: quote.spreadMinor,
    rail_cost_minor: quote.railCostMinor,
    total_cost_minor: quote.totalCostMinor,
    total_cost_bps: Math.round((quote.totalCostMinor / quote.amountInMinor) * 10_000),
    source: quote.source,
    quality: quote.quality,
    issued_at: new Date(quote.issuedAt).toISOString(),
    expires_at: new Date(quote.expiresAt).toISOString(),
    seconds_remaining: quoteSecondsRemaining(quote),
    corridor: {
      direction_label: corridor.directionLabel,
      rail_name: corridor.railName,
      rail_key_label: corridor.railKeyLabel,
      quote_ttl_seconds: corridor.quoteTtlSeconds,
      max_slippage_bps: corridor.maxSlippageBps,
      order_ttl_default_seconds: corridor.orderTtlDefaultSeconds,
      min_amount_minor: corridor.minAmountMinor,
      max_amount_minor: corridor.maxAmountMinor,
    },
    from_decimals: ASSET_META[corridor.fromAsset as keyof typeof ASSET_META]?.storageDecimals ?? 2,
    to_decimals: ASSET_META[corridor.toAsset as keyof typeof ASSET_META]?.storageDecimals ?? 2,
    from_display: fromMinor(quote.amountInMinor, corridor.fromAsset),
    to_display: fromMinor(quote.amountOutMinor, corridor.toAsset),
    comparisons,
  };
}

export function rateNumber(rate: string): number {
  return Number(rate);
}

export function scaledRateIsValid(rate: string): boolean {
  return toScaled(rate) > 0n;
}
