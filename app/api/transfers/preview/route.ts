import { buildTransferPreview, isTransferDestination, parseArsAmount, transferDestinations } from "@/lib/transfer-preview";
import { getOrCreateUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const destinations = Object.values(transferDestinations).map(({ code, name, currency, currencyName }) => ({
    code,
    name,
    currency,
    currencyName,
  }));
  return Response.json({ destinations }, { headers: { "Cache-Control": "no-store, max-age=0" } });
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

  const amountArs = parseArsAmount(body.amountArs);
  if (amountArs === null) {
    return Response.json({ detail: "Ingresá un monto en pesos mayor que cero." }, { status: 400 });
  }
  if (!isTransferDestination(body.destination)) {
    return Response.json({ detail: "Elegí un destino válido para la simulación." }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateUser(request.headers.get("user-agent"));
    const demoBalanceArs = user.demoBalanceMinor / 100;
    const preview = await buildTransferPreview(amountArs, body.destination);
    return Response.json({
      ...preview,
      demoBalanceArs,
      demoBalanceFormatted: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(demoBalanceArs),
      canSimulate: amountArs <= demoBalanceArs,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[cauce] no se pudo calcular la transferencia", error);
    return Response.json({ detail: "No se pudo consultar la conversión para ese destino." }, { status: 503 });
  }
}