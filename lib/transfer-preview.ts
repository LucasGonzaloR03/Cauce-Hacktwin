import "server-only";
import { getTick, type RateTick } from "@/lib/fx";

export const transferDestinations = {
  AR: {
    code: "AR",
    name: "Argentina",
    currency: "ARS",
    currencyName: "pesos argentinos",
    pair: "ARS/ARS",
    countryLocale: "es-AR",
    routeNote: "Transferencia local simulada en pesos; no requiere conversión a otra moneda.",
  },
  CO: {
    code: "CO",
    name: "Colombia",
    currency: "COP",
    currencyName: "pesos colombianos",
    pair: "USD/COP",
    countryLocale: "es-CO",
    routeNote: "USDT se aproxima a USD para convertir a COP.",
  },
  MX: {
    code: "MX",
    name: "México",
    currency: "MXN",
    currencyName: "pesos mexicanos",
    pair: "USDT/MXN",
    countryLocale: "es-MX",
    routeNote: "Conversión directa de USDT a MXN.",
  },
  BR: { code: "BR", name: "Brasil", currency: "BRL", currencyName: "reales brasileños", pair: "USD/BRL", countryLocale: "pt-BR", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  CL: { code: "CL", name: "Chile", currency: "CLP", currencyName: "pesos chilenos", pair: "USD/CLP", countryLocale: "es-CL", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  PE: { code: "PE", name: "Perú", currency: "PEN", currencyName: "soles peruanos", pair: "USD/PEN", countryLocale: "es-PE", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  UY: { code: "UY", name: "Uruguay", currency: "UYU", currencyName: "pesos uruguayos", pair: "USD/UYU", countryLocale: "es-UY", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  PY: { code: "PY", name: "Paraguay", currency: "PYG", currencyName: "guaraníes", pair: "USD/PYG", countryLocale: "es-PY", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  BO: { code: "BO", name: "Bolivia", currency: "BOB", currencyName: "bolivianos", pair: "USD/BOB", countryLocale: "es-BO", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  CR: { code: "CR", name: "Costa Rica", currency: "CRC", currencyName: "colones costarricenses", pair: "USD/CRC", countryLocale: "es-CR", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  DO: { code: "DO", name: "República Dominicana", currency: "DOP", currencyName: "pesos dominicanos", pair: "USD/DOP", countryLocale: "es-DO", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  GT: { code: "GT", name: "Guatemala", currency: "GTQ", currencyName: "quetzales", pair: "USD/GTQ", countryLocale: "es-GT", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  HN: { code: "HN", name: "Honduras", currency: "HNL", currencyName: "lempiras", pair: "USD/HNL", countryLocale: "es-HN", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  NI: { code: "NI", name: "Nicaragua", currency: "NIO", currencyName: "córdobas", pair: "USD/NIO", countryLocale: "es-NI", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  PA: { code: "PA", name: "Panamá", currency: "PAB", currencyName: "balboas", pair: "USD/PAB", countryLocale: "es-PA", routeNote: "El balboa mantiene paridad 1:1 con el dólar estadounidense." },
  VE: { code: "VE", name: "Venezuela", currency: "VES", currencyName: "bolívares", pair: "USD/VES", countryLocale: "es-VE", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  CU: { code: "CU", name: "Cuba", currency: "CUP", currencyName: "pesos cubanos", pair: "USD/CUP", countryLocale: "es-CU", routeNote: "Tasa de referencia de ExchangeRate API; puede diferir del mercado local." },
  HT: { code: "HT", name: "Haití", currency: "HTG", currencyName: "gourdes", pair: "USD/HTG", countryLocale: "fr-HT", routeNote: "USDT se aproxima a USD; tasa de referencia de ExchangeRate API." },
  EC: { code: "EC", name: "Ecuador", currency: "USD", currencyName: "dólares estadounidenses", pair: "USD/USD", countryLocale: "es-EC", routeNote: "Ecuador utiliza el dólar estadounidense; USDT se aproxima a USD." },
  SV: { code: "SV", name: "El Salvador", currency: "USD", currencyName: "dólares estadounidenses", pair: "USD/USD", countryLocale: "es-SV", routeNote: "El Salvador utiliza el dólar estadounidense; USDT se aproxima a USD." },
} as const;

export type TransferDestinationCode = keyof typeof transferDestinations;

const FEE_RATE = 0.01;
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

export function parseArsAmount(value: unknown, allowZero = false): number | null {
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
  const minimum = allowZero ? amount >= 0 : amount > 0;
  return Number.isFinite(amount) && minimum && amount <= 1_000_000_000_000 ? amount : null;
}

export function isTransferDestination(value: unknown): value is TransferDestinationCode {
  return typeof value === "string" && Object.hasOwn(transferDestinations, value);
}

function sourceName(source: string) {
  if (source.startsWith("dolarapi:")) return "DolarAPI";
  if (source.startsWith("bitso:")) return "Bitso";
  if (source === "open.er-api") return "ExchangeRate API";
  return source;
}

function combinedQuality(ticks: RateTick[]): RateTick["quality"] {
  if (ticks.some((tick) => tick.quality === "frozen")) return "frozen";
  if (ticks.some((tick) => tick.quality === "cached")) return "cached";
  return "live";
}

export async function buildTransferPreview(amountArs: number, destinationCode: TransferDestinationCode) {
  const destination = transferDestinations[destinationCode];
  if (destinationCode === "AR") {
    const feeArs = amountArs * FEE_RATE;
    const receivedAmount = amountArs - feeArs;
    const localFormatter = new Intl.NumberFormat(destination.countryLocale, {
      style: "currency",
      currency: destination.currency,
    });

    return {
      amountArs,
      amountArsFormatted: arsFormatter.format(amountArs),
      feeArs,
      feeArsFormatted: arsFormatter.format(feeArs),
      feeRatePercent: FEE_RATE * 100,
      usdtAmount: 0,
      usdtAmountFormatted: "No aplica",
      receivedAmount,
      receivedAmountFormatted: localFormatter.format(receivedAmount),
      destination: {
        code: destination.code,
        name: destination.name,
        currency: destination.currency,
        currencyName: destination.currencyName,
      },
      route: "ARS → ARS",
      exchangeRateFormatted: "Sin conversión de moneda",
      source: "Cauce · simulación local",
      observedAt: timeFormatter.format(new Date()),
      quality: "not_applicable" as const,
      routeNote: destination.routeNote,
      isDomestic: true,
    };
  }

  const [arsUsdt, destinationRate] = await Promise.all([
    getTick("USDT/ARS"),
    getTick(destination.pair),
  ]);

  const usdtArsRate = Number(arsUsdt.ask ?? arsUsdt.last);
  const payoutRate = Number(destinationRate.ask ?? destinationRate.last);
  if (!Number.isFinite(usdtArsRate) || usdtArsRate <= 0 || !Number.isFinite(payoutRate) || payoutRate <= 0) {
    throw new Error("Hay una cotización inválida.");
  }

  const feeArs = amountArs * FEE_RATE;
  const amountAfterFeeArs = amountArs - feeArs;
  const usdtAmount = amountAfterFeeArs / usdtArsRate;
  const receivedAmount = usdtAmount * payoutRate;
  const localFormatter = new Intl.NumberFormat(destination.countryLocale, {
    style: "currency",
    currency: destination.currency,
  });
  const localRateFormatter = new Intl.NumberFormat(destination.countryLocale, {
    maximumFractionDigits: 2,
  });
  const ticks = [arsUsdt, destinationRate];

  return {
    amountArs,
    amountArsFormatted: arsFormatter.format(amountArs),
    feeArs,
    feeArsFormatted: arsFormatter.format(feeArs),
    feeRatePercent: FEE_RATE * 100,
    usdtAmount,
    usdtAmountFormatted: `${usdtFormatter.format(usdtAmount)} USDT`,
    receivedAmount,
    receivedAmountFormatted: localFormatter.format(receivedAmount),
    destination: {
      code: destination.code,
      name: destination.name,
      currency: destination.currency,
      currencyName: destination.currencyName,
    },
    route: `ARS → USDT → ${destination.currency}`,
    isDomestic: false,
    exchangeRateFormatted: `1 USDT ≈ ${localRateFormatter.format(payoutRate)} ${destination.currency}`,
    source: `${sourceName(arsUsdt.source)} · ${sourceName(destinationRate.source)}`,
    observedAt: timeFormatter.format(new Date(
      arsUsdt.observedAt < destinationRate.observedAt ? arsUsdt.observedAt : destinationRate.observedAt,
    )),
    quality: combinedQuality(ticks),
    routeNote: destination.routeNote,
  };
}