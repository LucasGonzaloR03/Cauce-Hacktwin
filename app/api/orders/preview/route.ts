import { getTick } from "@/lib/fx";

export const dynamic = "force-dynamic";

const expirations = {
  "1h": { seconds: 60 * 60, label: "1 hora" },
  "24h": { seconds: 24 * 60 * 60, label: "24 horas" },
  "7d": { seconds: 7 * 24 * 60 * 60, label: "7 días" },
  gtc: { seconds: null, label: "Hasta cancelar (GTC)" },
} as const;

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const usdtFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Argentina/Buenos_Aires",
});

function parseArgentineAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw || !/^[\d.,]+$/.test(raw)) return null;

  let normalized = raw;
  if (raw.includes(",")) {
    if ((raw.match(/,/g) ?? []).length !== 1) return null;
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000_000 ? amount : null;
}

function sourceName(source: string) {
  if (source.startsWith("dolarapi:")) return "DolarAPI";
  if (source.startsWith("bitso:")) return "Bitso";
  return source;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ detail: "El pedido no tiene un formato válido." }, { status: 400 });
  }

  const amount = parseArgentineAmount(body.amountArs);
  if (amount === null) {
    return Response.json({ detail: "Ingresá un monto en pesos mayor que cero." }, { status: 400 });
  }

  if (typeof body.expiration !== "string" || !Object.hasOwn(expirations, body.expiration)) {
    return Response.json({ detail: "Elegí un vencimiento válido." }, { status: 400 });
  }

  const expiration = expirations[body.expiration as keyof typeof expirations];

  try {
    const tick = await getTick("USDT/ARS");
    const rate = Number(tick.ask ?? tick.last);
    const estimatedUsdt = amount / rate;
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(estimatedUsdt)) {
      throw new Error("Cotización inválida");
    }

    return Response.json(
      {
        amountArs: arsFormatter.format(amount),
        estimatedUsdt: `${usdtFormatter.format(estimatedUsdt)} USDT`,
        rate: `${arsFormatter.format(rate)} por USDT`,
        source: sourceName(tick.source),
        observedAt: timeFormatter.format(new Date(tick.observedAt)),
        quality: tick.quality,
        expiration: expiration.label,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return Response.json(
      { detail: "No se pudo calcular: la cotización de USDT no está disponible." },
      { status: 503 },
    );
  }
}