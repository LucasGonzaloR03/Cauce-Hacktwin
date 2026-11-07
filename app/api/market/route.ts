import { getTick } from "@/lib/fx";

export const dynamic = "force-dynamic";

const markets = [
  { id: "mep", name: "Dólar MEP", detail: "Bolsa", pair: "USD/ARS" },
  { id: "blue", name: "Dólar blue", detail: "Referencia", pair: "USD_BLUE/ARS" },
  { id: "official", name: "Dólar oficial", detail: "Referencia", pair: "USD_OFFICIAL/ARS" },
  { id: "card", name: "Dólar tarjeta", detail: "Referencia", pair: "USD_TARJETA/ARS" },
  { id: "usdt", name: "USDT", detail: "Cripto", pair: "USDT/ARS" },
  { id: "btc", name: "BTC / ARS", detail: "Cripto", pair: "BTC/ARS" },
] as const;

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Argentina/Buenos_Aires",
});

function sourceName(source: string) {
  if (source.startsWith("dolarapi:")) return "DolarAPI";
  if (source.startsWith("bitso:")) return "Bitso";
  return source;
}

async function getMarketPrice(market: (typeof markets)[number]) {
  try {
    const tick = await getTick(market.pair);
    const value = Number(tick.last);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Precio inválido");

    return {
      ...market,
      rate: tick.last,
      price: arsFormatter.format(value),
      source: sourceName(tick.source),
      observedAt: timeFormatter.format(new Date(tick.observedAt)),
      quality: tick.quality,
    };
  } catch {
    return { ...market, rate: null, price: null, source: null, observedAt: null, quality: null };
  }
}

export async function GET() {
  const items = await Promise.all(markets.map(getMarketPrice));
  return Response.json(
    { items },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}