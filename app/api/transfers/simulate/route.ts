import { randomUUID } from "node:crypto";
import { buildTransferPreview, isTransferDestination, parseArsAmount } from "@/lib/transfer-preview";

export const dynamic = "force-dynamic";

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ detail: "El pedido no tiene un formato válido." }, { status: 400 });
  }

  const amountArs = parseArsAmount(body.amountArs);
  const demoBalanceArs = parseArsAmount(body.demoBalanceArs, true);
  if (amountArs === null || demoBalanceArs === null || !isTransferDestination(body.destination)) {
    return Response.json({ detail: "Revisá el monto, el saldo demo y el país elegido." }, { status: 400 });
  }
  if (amountArs > demoBalanceArs) {
    return Response.json({ detail: "El monto supera el saldo disponible en la demo." }, { status: 422 });
  }

  try {
    const preview = await buildTransferPreview(amountArs, body.destination);
    const balanceAfterArs = demoBalanceArs - amountArs;
    const simulatedAt = dateTimeFormatter.format(new Date());

    return Response.json({
      ...preview,
      simulationId: randomUUID(),
      simulatedAt,
      balanceAfterArs,
      balanceAfterFormatted: arsFormatter.format(balanceAfterArs),
      journey: [
        { title: "Saldo demo en ARS", detail: `${preview.amountArsFormatted} debitados del saldo de prueba.` },
        { title: "Conversión a USDT", detail: `${preview.usdtAmountFormatted} · Bitso.` },
        { title: `Conversión a ${preview.destination.currency}`, detail: `${preview.receivedAmountFormatted} · ${preview.source}.` },
        { title: `Destino demo en ${preview.destination.name}`, detail: "Simulado; no se hizo ningún payout real." },
      ],
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[cauce] no se pudo simular la transferencia", error);
    return Response.json({ detail: "No se pudo simular la conversión para ese destino." }, { status: 503 });
  }
}