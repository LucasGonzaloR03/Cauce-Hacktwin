import "server-only";
import { desc, eq, gte } from "drizzle-orm";
import { priceSnapshots, type DataQuality } from "@/db/schema";
import { ProblemError } from "./problem";

export type RateTick = {
  pair: string;
  countryCode: string;
  source: string;
  bid: string | null;
  ask: string | null;
  last: string;
  observedAt: string;
  fetchedAt: string;
  quality: DataQuality;
};

type Provider =
  | { id: "bitso"; book: string }
  | { id: "dolarapi"; casa: string }
  | { id: "erapi"; currency: string }
  | { id: "cross"; legs: [string, string]; label: string };

type PairConfig = {
  countryCode: string;
  providers: Provider[];
};

export const PAIRS: Record<string, PairConfig> = {
  // Argentina: el MEP es el precio de la remesa; Bitso queda como respaldo vivo.
  "USD/ARS": {
    countryCode: "AR",
    providers: [{ id: "dolarapi", casa: "bolsa" }],
  },
  "USD_BLUE/ARS": { countryCode: "AR", providers: [{ id: "dolarapi", casa: "blue" }] },
  "USD_OFFICIAL/ARS": { countryCode: "AR", providers: [{ id: "dolarapi", casa: "oficial" }] },
  "USD_TARJETA/ARS": { countryCode: "AR", providers: [{ id: "dolarapi", casa: "tarjeta" }] },
  "USDT/ARS": { countryCode: "AR", providers: [{ id: "bitso", book: "usdt_ars" }] },
  "BTC/ARS": { countryCode: "AR", providers: [{ id: "bitso", book: "btc_ars" }] },
  // No hay libro ETH/ARS: se cruza ETH/USD por el dólar cripto.
  "ETH/ARS": {
    countryCode: "AR",
    providers: [{ id: "cross", legs: ["ETH/USD", "USDT/ARS"], label: "bitso · cruzado" }],
  },

  // México: Bitso tiene libros de los tres activos.
  "USD/MXN": { countryCode: "MX", providers: [{ id: "bitso", book: "usd_mxn" }] },
  "USDT/MXN": { countryCode: "MX", providers: [{ id: "bitso", book: "usdt_mxn" }] },
  "BTC/MXN": { countryCode: "MX", providers: [{ id: "bitso", book: "btc_mxn" }] },
  "ETH/MXN": { countryCode: "MX", providers: [{ id: "bitso", book: "eth_mxn" }] },

  // Pares de dólar para cruces y comparaciones.
  "BTC/USD": { countryCode: "US", providers: [{ id: "bitso", book: "btc_usd" }] },
  "ETH/USD": { countryCode: "US", providers: [{ id: "bitso", book: "eth_usd" }] },

  // Colombia: solo hay snapshot (open.er-api queda como intento en vivo).
  "USD/COP": { countryCode: "CO", providers: [{ id: "erapi", currency: "COP" }] },
  "USD/BRL": { countryCode: "BR", providers: [{ id: "erapi", currency: "BRL" }] },
  "USD/CLP": { countryCode: "CL", providers: [{ id: "erapi", currency: "CLP" }] },
  "USD/PEN": { countryCode: "PE", providers: [{ id: "erapi", currency: "PEN" }] },
  "USD/UYU": { countryCode: "UY", providers: [{ id: "erapi", currency: "UYU" }] },
  "USD/PYG": { countryCode: "PY", providers: [{ id: "erapi", currency: "PYG" }] },
  "USD/BOB": { countryCode: "BO", providers: [{ id: "erapi", currency: "BOB" }] },
  "USD/CRC": { countryCode: "CR", providers: [{ id: "erapi", currency: "CRC" }] },
  "USD/DOP": { countryCode: "DO", providers: [{ id: "erapi", currency: "DOP" }] },
  "USD/GTQ": { countryCode: "GT", providers: [{ id: "erapi", currency: "GTQ" }] },
  "USD/HNL": { countryCode: "HN", providers: [{ id: "erapi", currency: "HNL" }] },
  "USD/NIO": { countryCode: "NI", providers: [{ id: "erapi", currency: "NIO" }] },
  "USD/PAB": { countryCode: "PA", providers: [{ id: "erapi", currency: "PAB" }] },
  "USD/VES": { countryCode: "VE", providers: [{ id: "erapi", currency: "VES" }] },
  "USD/CUP": { countryCode: "CU", providers: [{ id: "erapi", currency: "CUP" }] },
  "USD/HTG": { countryCode: "HT", providers: [{ id: "erapi", currency: "HTG" }] },
  "USD/USD": { countryCode: "EC", providers: [{ id: "erapi", currency: "USD" }] },
};

const MEMORY_TTL_MS = 12_000;
const CACHED_TTL_MS = 30 * 60 * 1000;
const PERSIST_EVERY_MS = 10_000;
const FETCH_TIMEOUT_MS = 2_500;

const memory = new Map<string, { at: number; tick: RateTick }>();
const inflight = new Map<string, Promise<RateTick>>();
const lastPersist = new Map<string, number>();

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "Cauce/0.1 (+hackathon)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function iso(value: string | number | Date | undefined, fallback = new Date()): string {
  if (!value) return fallback.toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
}

function qualityFor(observedAt: string): DataQuality {
  const age = Date.now() - new Date(observedAt).getTime();
  if (!Number.isFinite(age) || age < -60_000 || age > CACHED_TTL_MS) return "frozen";
  return age > MEMORY_TTL_MS ? "cached" : "live";
}

async function fetchBitso(book: string): Promise<Omit<RateTick, "pair" | "countryCode">> {
  const json = (await fetchJson(`https://api.bitso.com/v3/ticker/?book=${encodeURIComponent(book)}`)) as {
    success?: boolean;
    payload?: { last?: string; bid?: string; ask?: string; created_at?: string; high?: string; low?: string };
  };
  if (!json.success || !json.payload?.last) throw new Error(`Bitso ${book} sin datos`);
  const now = new Date().toISOString();
  const observedAt = iso(json.payload.created_at);
  return {
    source: `bitso:${book}`,
    bid: json.payload.bid ?? null,
    ask: json.payload.ask ?? null,
    last: json.payload.last,
    observedAt,
    fetchedAt: now,
    quality: qualityFor(observedAt),
  };
}

async function fetchDolarapi(casa: string): Promise<Omit<RateTick, "pair" | "countryCode">> {
  const json = (await fetchJson(`https://dolarapi.com/v1/dolares/${encodeURIComponent(casa)}`)) as {
    compra?: number;
    venta?: number;
    fechaActualizacion?: string;
  };
  if (!json?.venta) throw new Error(`dolarapi ${casa} sin datos`);
  const observedAt = iso(json.fechaActualizacion);
  return {
    source: `dolarapi:${casa}`,
    bid: json.compra != null ? String(json.compra) : null,
    ask: String(json.venta),
    last: String(json.venta),
    observedAt,
    fetchedAt: new Date().toISOString(),
    quality: qualityFor(observedAt),
  };
}

async function fetchErApi(currency: string): Promise<Omit<RateTick, "pair" | "countryCode">> {
  const json = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_unix?: number;
  };
  if (json.result !== "success" || !json.rates?.[currency]) throw new Error(`open.er-api sin ${currency}`);
  const value = json.rates[currency];
  const observedAt = iso((json.time_last_update_unix ?? 0) * 1000);
  return {
    source: "open.er-api",
    bid: null,
    ask: String(value),
    last: String(value),
    observedAt,
    fetchedAt: new Date().toISOString(),
    quality: qualityFor(observedAt),
  };
}

async function fetchProvider(pair: string, provider: Provider): Promise<Omit<RateTick, "pair" | "countryCode">> {
  switch (provider.id) {
    case "bitso":
      return fetchBitso(provider.book);
    case "dolarapi":
      return fetchDolarapi(provider.casa);
    case "erapi":
      return fetchErApi(provider.currency);
    case "cross": {
      const [a, b] = await Promise.all(provider.legs.map((leg) => getTick(leg)));
      const last = Number(a.last) * Number(b.last);
      if (!Number.isFinite(last) || last <= 0) throw new Error("cruce inválido");
      return {
        source: provider.label,
        bid: a.bid && b.bid ? String(Number(a.bid) * Number(b.bid)) : null,
        ask: a.ask && b.ask ? String(Number(a.ask) * Number(b.ask)) : null,
        last: String(last),
        observedAt: a.observedAt,
        fetchedAt: new Date().toISOString(),
        quality:
          a.quality === "frozen" || b.quality === "frozen"
            ? "frozen"
            : a.quality === "cached" || b.quality === "cached"
              ? "cached"
              : "live",
      };
    }
  }
}

async function persist(tick: RateTick) {
  if (!process.env.DATABASE_URL) return;
  const now = Date.now();
  const previous = lastPersist.get(tick.pair) ?? 0;
  if (now - previous < PERSIST_EVERY_MS) return;
  lastPersist.set(tick.pair, now);
  try {
    const { db } = await import("@/db");
    await db.insert(priceSnapshots).values({
      pair: tick.pair,
      countryCode: tick.countryCode,
      source: tick.source,
      bid: tick.bid,
      ask: tick.ask,
      last: tick.last,
      observedAt: new Date(tick.observedAt),
      fetchedAt: new Date(tick.fetchedAt),
      quality: tick.quality,
    });
  } catch (error) {
    console.warn("[cauce] no se pudo guardar el snapshot de precio", error);
  }
}

async function lastSnapshot(pair: string): Promise<RateTick | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    const rows = await db
      .select()
      .from(priceSnapshots)
      .where(eq(priceSnapshots.pair, pair))
      .orderBy(desc(priceSnapshots.fetchedAt))
      .limit(1);
    if (!rows.length) return null;
    const row = rows[0];
    const age = Date.now() - new Date(row.fetchedAt).getTime();
    return {
      pair: row.pair,
      countryCode: row.countryCode,
      source: row.source,
      bid: row.bid,
      ask: row.ask,
      last: row.last,
      observedAt: new Date(row.observedAt).toISOString(),
      fetchedAt: new Date(row.fetchedAt).toISOString(),
      quality:
        row.quality === "frozen" || age > CACHED_TTL_MS
          ? "frozen"
          : row.quality === "cached" || age > MEMORY_TTL_MS
            ? "cached"
            : "live",
    };
  } catch (error) {
    console.warn("[cauce] no se pudo leer el snapshot de precio", error);
    return null;
  }
}

async function resolveTick(pair: string): Promise<RateTick> {
  const config = PAIRS[pair];
  if (!config) throw new ProblemError("BAD_REQUEST", `No hay configuración de precio para ${pair}.`);

  const fresh = memory.get(pair);
  if (fresh && Date.now() - fresh.at < MEMORY_TTL_MS) return fresh.tick;

  const pending = inflight.get(pair);
  if (pending) return pending;

  const promise = (async () => {
    for (const provider of config.providers) {
      try {
        const data = await fetchProvider(pair, provider);
        const tick: RateTick = { ...data, pair, countryCode: config.countryCode };
        memory.set(pair, { at: Date.now(), tick });
        void persist(tick);
        return tick;
      } catch (error) {
        console.warn(`[cauce] fuente ${provider.id} falló para ${pair}:`, (error as Error).message);
      }
    }

    const fallback = await lastSnapshot(pair);
    if (fallback) {
      memory.set(pair, { at: Date.now(), tick: fallback });
      return fallback;
    }
    throw new ProblemError(
      "UPSTREAM_UNAVAILABLE",
      `Ninguna fuente respondió para ${pair} y no hay precio de respaldo.`,
    );
  })().finally(() => inflight.delete(pair));

  inflight.set(pair, promise);
  return promise;
}

export async function getTick(pair: string): Promise<RateTick> {
  return resolveTick(pair);
}

export function pairFor(assetCode: string, rateCurrency: string): string {
  return `${assetCode}/${rateCurrency}`;
}

export async function getHistory(pair: string, minutes = 60, targetPoints = 90) {
  const { db } = await import("@/db");
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const rows = await db
    .select({
      fetchedAt: priceSnapshots.fetchedAt,
      last: priceSnapshots.last,
      source: priceSnapshots.source,
      quality: priceSnapshots.quality,
    })
    .from(priceSnapshots)
    .where(gte(priceSnapshots.fetchedAt, since))
    .orderBy(priceSnapshots.fetchedAt)
    .limit(600);

  const filtered = rows.filter((r) => r.source !== "demo" || true);
  const points = filtered.map((r) => ({
    t: new Date(r.fetchedAt).toISOString(),
    rate: Number(r.last),
    source: r.source,
    quality: r.quality,
  }));

  if (points.length <= targetPoints) {
    const live = await getTick(pair).catch(() => null);
    if (live && (!points.length || live.fetchedAt > points[points.length - 1].t)) {
      points.push({ t: live.fetchedAt, rate: Number(live.last), source: live.source, quality: live.quality });
    }
    return points;
  }

  const step = Math.ceil(points.length / targetPoints);
  const sampled = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1]?.t !== last.t) sampled.push(last);
  return sampled;
}

export async function injectTick(pair: string, rate: number, label: string): Promise<RateTick> {
  const config = PAIRS[pair];
  if (!config) throw new ProblemError("BAD_REQUEST", `Par desconocido: ${pair}`);
  if (!Number.isFinite(rate) || rate <= 0) throw new ProblemError("BAD_REQUEST", "El precio tiene que ser positivo.");

  const now = new Date().toISOString();
  const tick: RateTick = {
    pair,
    countryCode: config.countryCode,
    source: `demo:${label || "tick"}`,
    bid: String(rate),
    ask: String(rate),
    last: String(rate),
    observedAt: now,
    fetchedAt: now,
    quality: "live",
  };
  memory.set(pair, { at: Date.now(), tick });
  if (!process.env.DATABASE_URL) return tick;
  try {
    const { db } = await import("@/db");
    await db.insert(priceSnapshots).values({
      pair,
      countryCode: config.countryCode,
      source: tick.source,
      bid: tick.bid,
      ask: tick.ask,
      last: tick.last,
      observedAt: new Date(now),
      fetchedAt: new Date(now),
      quality: "live",
      raw: { injected: true, label },
    });
  } catch (error) {
    console.warn("[cauce] no se pudo persistir el tick inyectado", error);
  }
  return tick;
}

export async function seedSnapshot(pair: string, rate: number, source = "seed", at?: Date) {
  const config = PAIRS[pair];
  if (!config) return;
  const { db } = await import("@/db");
  const when = at ?? new Date();
  await db.insert(priceSnapshots).values({
    pair,
    countryCode: config.countryCode,
    source,
    bid: String(rate),
    ask: String(rate),
    last: String(rate),
    observedAt: when,
    fetchedAt: when,
    quality: "frozen",
    raw: { seeded: true },
  });
}

export function clearRateCache() {
  memory.clear();
  lastPersist.clear();
}
