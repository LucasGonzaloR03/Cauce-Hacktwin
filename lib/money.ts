/**
 * Dinero en enteros de la unidad mínima. Nunca float para montos.
 * Las tasas se guardan como string decimal y se operan escaladas a 1e10.
 */

export const RATE_DECIMALS = 10;
export const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);
const BPS_DEN = 10_000n;
const HALF = 5n;

export type AssetCode = "ARS" | "USD" | "USDT" | "BTC" | "ETH" | "MXN" | "COP";

export const ASSET_META: Record<
  AssetCode,
  { symbol: string; storageDecimals: number; displayDecimals: number; kind: "fiat" | "crypto"; name: string }
> = {
  ARS: { symbol: "$", storageDecimals: 2, displayDecimals: 0, kind: "fiat", name: "Peso argentino" },
  USD: { symbol: "US$", storageDecimals: 2, displayDecimals: 2, kind: "fiat", name: "Dólar" },
  MXN: { symbol: "$", storageDecimals: 2, displayDecimals: 2, kind: "fiat", name: "Peso mexicano" },
  COP: { symbol: "$", storageDecimals: 2, displayDecimals: 0, kind: "fiat", name: "Peso colombiano" },
  USDT: { symbol: "USDT", storageDecimals: 2, displayDecimals: 2, kind: "crypto", name: "Tether" },
  BTC: { symbol: "BTC", storageDecimals: 8, displayDecimals: 6, kind: "crypto", name: "Bitcoin" },
  ETH: { symbol: "ETH", storageDecimals: 8, displayDecimals: 6, kind: "crypto", name: "Ether" },
};

export function assetMeta(code: string) {
  return ASSET_META[code as AssetCode] ?? ASSET_META.USD;
}

export function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/** Convierte un decimal ("1581.1", 1653.9) a entero escalado 1e10. */
export function toScaled(value: string | number): bigint {
  const raw = typeof value === "number" ? value.toFixed(RATE_DECIMALS) : String(value).trim();
  const negative = raw.startsWith("-");
  const clean = negative ? raw.slice(1) : raw;
  const [intPart, fracPart = ""] = clean.split(".");
  const frac = (fracPart + "0".repeat(RATE_DECIMALS)).slice(0, RATE_DECIMALS);
  const digits = `${intPart || "0"}${frac}`.replace(/^0+(?=\d)/, "");
  const scaled = BigInt(digits || "0");
  return negative ? -scaled : scaled;
}

export function scaledToNumber(scaled: bigint): number {
  return Number(scaled) / Number(RATE_SCALE);
}

export function scaledToString(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const int = abs / RATE_SCALE;
  const frac = (abs % RATE_SCALE).toString().padStart(RATE_DECIMALS, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

export function validateRate(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
}

export function invertRate(rate: string): string {
  const scaled = toScaled(rate);
  if (scaled === 0n) return "0";
  return scaledToString((RATE_SCALE * RATE_SCALE) / scaled);
}

/** Redondeo half-up entero, simétrico para negativos. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("División por cero en cálculo monetario");
  const negative = numerator < 0n !== denominator < 0n;
  const absN = numerator < 0n ? -numerator : numerator;
  const absD = denominator < 0n ? -denominator : denominator;
  const q = (absN * 2n + absD) / (absD * 2n);
  return negative ? -q : q;
}

/** amountMinor de `from` → amountMinor de `to`, dado rate = unidades de `to` por 1 de `from`. */
export function convertMinor(
  amountMinor: number,
  fromDecimals: number,
  toDecimals: number,
  rate: string,
): number {
  const rateScaled = toScaled(rate);
  const numerator = BigInt(amountMinor) * pow10(toDecimals) * RATE_SCALE;
  const denominator = pow10(fromDecimals) * rateScaled;
  return Number(divRound(numerator, denominator));
}

export function applyBps(amountMinor: number, bps: number): number {
  return Number(divRound(BigInt(amountMinor) * BigInt(bps), BPS_DEN));
}

export function removeBps(amountMinor: number, bps: number): number {
  return amountMinor - applyBps(amountMinor, bps);
}

/** Costo en puntos básicos sobre el monto de entrada, como entero. */
export function bpsOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 10_000);
}

export type LocaleCode = "es-AR" | "es-MX" | "es-CO";

export function formatMoney(minor: number, asset: string, locale: LocaleCode = "es-AR"): string {
  const meta = assetMeta(asset);
  const value = minor / 10 ** meta.storageDecimals;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: meta.displayDecimals,
    maximumFractionDigits: meta.displayDecimals,
  }).format(value);
  if (meta.kind === "crypto") return `${formatted} ${meta.symbol}`;
  return `${meta.symbol} ${formatted}`;
}

export function formatMoneyPlain(minor: number, asset: string, locale: LocaleCode = "es-AR"): string {
  const meta = assetMeta(asset);
  const value = minor / 10 ** meta.storageDecimals;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: meta.displayDecimals,
    maximumFractionDigits: meta.displayDecimals,
  }).format(value);
}

export function formatRate(rate: string | number, locale: LocaleCode = "es-AR"): string {
  const n = typeof rate === "number" ? rate : Number(rate);
  const decimals = n >= 10_000 ? 0 : n >= 100 ? 1 : n >= 1 ? 2 : 6;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",")}%`;
}

/** Acepta "1.640", "1640", "1.640,50", "1640.5" y devuelve number. */
export function parseLocalNumber(input: string): number {
  const clean = input.trim().replace(/\s|US\$|\$|BTC|ETH|USDT/gi, "");
  if (!clean) return 0;
  const hasComma = clean.includes(",");
  const hasDot = clean.includes(".");
  let normalized = clean;
  if (hasComma && hasDot) {
    normalized = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (hasComma) {
    normalized = clean.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function toMinor(value: number, asset: string): number {
  const meta = assetMeta(asset);
  return Math.round(value * 10 ** meta.storageDecimals);
}

export function fromMinor(minor: number, asset: string): number {
  const meta = assetMeta(asset);
  return minor / 10 ** meta.storageDecimals;
}
