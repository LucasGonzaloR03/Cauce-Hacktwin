import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { demoTransfers, users } from "@/db/schema";
import { getOrCreateUser } from "@/lib/session";
import { buildTransferPreview, isTransferDestination, parseArsAmount } from "@/lib/transfer-preview";
import type { DemoTransferRecord, DemoTransferSnapshot } from "@/lib/demo-types";

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
  if (amountArs === null || !isTransferDestination(body.destination)) {
    return Response.json({ detail: "Revisá el monto y el país elegido." }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateUser(request.headers.get("user-agent"));
    const preview = await buildTransferPreview(amountArs, body.destination);
    const simulationId = randomUUID();
    const amountArsMinor = Math.round(amountArs * 100);
    const simulatedAt = dateTimeFormatter.format(new Date());
    const record: DemoTransferRecord = {
      ...preview,
      canSimulate: true,
      simulationId,
      simulatedAt,
      journey: preview.isDomestic
        ? [
            { title: "Saldo demo en ARS", detail: `${preview.amountArsFormatted} debitados del saldo de prueba.` },
            { title: "Transferencia local", detail: `${preview.receivedAmountFormatted} después de la comisión demo.` },
            { title: "Destino demo en Argentina", detail: "Simulado; no se hizo ningún envío real." },
          ]
        : [
            { title: "Saldo demo en ARS", detail: `${preview.amountArsFormatted} debitados del saldo de prueba.` },
            { title: "Conversión a USDT", detail: `${preview.usdtAmountFormatted} · Bitso.` },
            { title: `Conversión a ${preview.destination.currency}`, detail: `${preview.receivedAmountFormatted} · ${preview.source}.` },
            { title: `Destino demo en ${preview.destination.name}`, detail: "Simulado; no se hizo ningún payout real." },
          ],
    };
    const writeResult = await db.execute(sql`
      WITH updated_user AS (
        UPDATE users
        SET demo_balance_minor = demo_balance_minor - ${amountArsMinor}
        WHERE id = ${user.id} AND demo_balance_minor >= ${amountArsMinor}
        RETURNING demo_balance_minor
      ), inserted_transfer AS (
        INSERT INTO demo_transfers (
          id, user_id, amount_ars_minor, balance_after_minor, destination_code, result
        )
        SELECT
          ${simulationId}::uuid,
          ${user.id}::uuid,
          ${amountArsMinor},
          updated_user.demo_balance_minor,
          ${body.destination},
          ${JSON.stringify(record)}::jsonb
        FROM updated_user
        RETURNING id, balance_after_minor
      )
      SELECT id, balance_after_minor FROM inserted_transfer
    `);
    const written = writeResult.rows[0] as { id: string; balance_after_minor: number | string } | undefined;
    if (!written) {
      return Response.json({ detail: "El monto supera el saldo disponible en la demo." }, { status: 422 });
    }
    const balanceAfterArs = Number(written.balance_after_minor) / 100;
    const simulation: DemoTransferSnapshot = {
      ...record,
      balanceAfterArs,
      balanceAfterFormatted: arsFormatter.format(balanceAfterArs),
    };

    return Response.json(simulation, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[cauce] no se pudo simular la transferencia", error);
    return Response.json({
      detail: process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "No se pudo simular la conversión para ese destino.",
    }, { status: 503 });
  }
}