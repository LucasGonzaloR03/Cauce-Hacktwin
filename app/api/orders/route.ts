import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { demoOrders } from "@/db/schema";
import { getTick } from "@/lib/fx";
import { evaluateDemoOrders } from "@/lib/orders/evaluate";
import { toMinor } from "@/lib/money";
import { getOrCreateUser } from "@/lib/session";
import { parseArsAmount } from "@/lib/transfer-preview";
import type { DemoOrder } from "@/db/schema";

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
const usdtFormatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

function developmentError(error: unknown) {
  if (process.env.NODE_ENV !== "development" || !(error instanceof Error)) return undefined;
  const cause = error.cause;
  return cause instanceof Error ? cause.message : error.message;
}

function serializeOrder(order: DemoOrder) {
  const amountArs = order.amountArsMinor / 100;
  const referenceRate = Number(order.referenceRate);
  const targetRate = Number(order.targetRate);
  const expiration = expirations[order.expirationCode as keyof typeof expirations]?.label ?? order.expirationCode;
  return {
    id: order.id,
    amountArs,
    amountArsFormatted: arsFormatter.format(amountArs),
    estimatedUsdt: `${usdtFormatter.format(amountArs / Number(order.filledRate ?? order.targetRate))} USDT`,
    targetRate,
    targetRateFormatted: arsFormatter.format(targetRate),
    referenceRate,
    referenceRateFormatted: arsFormatter.format(referenceRate),
    expirationCode: order.expirationCode,
    expiration,
    status: order.status,
    executionMode: order.executionMode,
    filledRate: order.filledRate ? Number(order.filledRate) : null,
    filledRateFormatted: order.filledRate ? `${arsFormatter.format(Number(order.filledRate))} / USDT` : null,
    executedAt: order.executedAt ? dateFormatter.format(order.executedAt) : null,
    isMock: order.isMock,
    source: order.source,
    quality: order.quality,
    observedAt: dateFormatter.format(order.observedAt),
    createdAt: dateFormatter.format(order.createdAt),
    expiresAt: order.expiresAt ? dateFormatter.format(order.expiresAt) : null,
  };
}

async function seedMockOrders(userId: string) {
  const tick = await getTick("USDT/ARS");
  const referenceRate = Number(tick.ask ?? tick.last);
  if (!Number.isFinite(referenceRate) || referenceRate <= 0) throw new Error("Cotización inválida para las muestras.");

  const firstAmountMinor = toMinor(100_000, "ARS");
  const secondAmountMinor = toMinor(250_000, "ARS");
  const firstTarget = referenceRate * 0.98;
  const secondTarget = referenceRate * 0.95;
  const now = new Date();

  await db.execute(sql`
    WITH first_visit AS (
      UPDATE users
      SET flags = COALESCE(flags, '{}'::jsonb) || '{"demoOrdersSeeded": true}'::jsonb
      WHERE id = ${userId}::uuid AND flags->>'demoOrdersSeeded' IS DISTINCT FROM 'true'
      RETURNING id
    )
    INSERT INTO demo_orders (
      user_id, amount_ars_minor, target_rate, reference_rate, estimated_usdt,
      expiration_code, status, is_mock, source, quality, observed_at, expires_at
    )
    SELECT id, ${firstAmountMinor}::bigint, ${String(firstTarget)}::numeric, ${String(referenceRate)}::numeric,
      ${String(100_000 / firstTarget)}::numeric, '7d'::text, 'ARMED'::order_status, true,
      ${tick.source}::text, ${tick.quality}::data_quality, ${new Date(tick.observedAt)}::timestamptz,
      ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)}::timestamptz
    FROM first_visit
    UNION ALL
    SELECT id, ${secondAmountMinor}::bigint, ${String(secondTarget)}::numeric, ${String(referenceRate)}::numeric,
      ${String(250_000 / secondTarget)}::numeric, '24h'::text, 'ARMED'::order_status, true,
      ${tick.source}::text, ${tick.quality}::data_quality, ${new Date(tick.observedAt)}::timestamptz,
      ${new Date(now.getTime() + 24 * 60 * 60 * 1000)}::timestamptz
    FROM first_visit
  `);
}

export async function GET(request: Request) {
  try {
    const { user } = await getOrCreateUser(request.headers.get("user-agent"));
    if (user.flags && typeof user.flags === "object" && !Array.isArray(user.flags) && !("demoOrdersSeeded" in user.flags)) {
      await seedMockOrders(user.id);
    }

    const pending = await db.select().from(demoOrders).where(and(
      eq(demoOrders.userId, user.id),
      eq(demoOrders.status, "ARMED"),
      eq(demoOrders.isMock, false),
    ));
    await evaluateDemoOrders(pending.map((order) => ({
      order,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
    })), request);

    const rows = await db.select().from(demoOrders)
      .where(eq(demoOrders.userId, user.id))
      .orderBy(desc(demoOrders.createdAt));
    return Response.json({ orders: rows.map(serializeOrder) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[cauce] no se pudieron cargar las órdenes demo", error);
    return Response.json({
      detail: developmentError(error)
        ?? "No se pudieron cargar las órdenes. Revisá la conexión con la base de datos.",
    }, { status: 503 });
  }
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
  const targetRate = parseArsAmount(body.targetRate);
  if (amountArs === null || targetRate === null) {
    return Response.json({ detail: "Ingresá un monto y un precio objetivo válidos." }, { status: 400 });
  }
  if (typeof body.expiration !== "string" || !Object.hasOwn(expirations, body.expiration)) {
    return Response.json({ detail: "Elegí un vencimiento válido." }, { status: 400 });
  }
  if (body.executionMode != null && body.executionMode !== "ALERT" && body.executionMode !== "AUTO_SIMULATE") {
    return Response.json({ detail: "Elegí un modo de orden válido." }, { status: 400 });
  }
  const executionMode = body.executionMode === "AUTO_SIMULATE" ? "AUTO_SIMULATE" : "ALERT";
  if (executionMode === "AUTO_SIMULATE" && body.autoConsent !== true) {
    return Response.json({ detail: "Confirmá la autorización para activar la compra simulada automática." }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateUser(request.headers.get("user-agent"));
    const tick = await getTick("USDT/ARS");
    if (executionMode === "AUTO_SIMULATE" && tick.quality !== "live") {
      return Response.json({ detail: "La compra automática necesita una cotización en vivo. Probá de nuevo cuando el mercado tenga datos actuales." }, { status: 422 });
    }
    const referenceRate = Number(tick.ask ?? tick.last);
    if (!Number.isFinite(referenceRate) || referenceRate <= 0) throw new Error("Cotización inválida.");
    if (targetRate >= referenceRate) {
      return Response.json({ detail: "El precio objetivo debe ser menor que la cotización actual." }, { status: 422 });
    }

    const amountArsMinor = toMinor(amountArs, "ARS");
    const expiration = expirations[body.expiration as keyof typeof expirations];
    const expiresAt = expiration.seconds === null ? null : new Date(Date.now() + expiration.seconds * 1000);
    const result = await db.execute(sql`
      WITH available_balance AS (
        UPDATE users
        SET demo_balance_minor = demo_balance_minor - ${amountArsMinor}::bigint
        WHERE id = ${user.id}::uuid AND demo_balance_minor >= ${amountArsMinor}::bigint
        RETURNING id
      )
      INSERT INTO demo_orders (
        user_id, amount_ars_minor, target_rate, reference_rate, estimated_usdt,
        expiration_code, status, execution_mode, auto_consent_at, is_mock, source, quality, observed_at, expires_at
      )
      SELECT ${user.id}::uuid, ${amountArsMinor}::bigint, ${String(targetRate)}::numeric,
        ${String(referenceRate)}::numeric, ${String(amountArs / targetRate)}::numeric,
        ${body.expiration}::text, 'ARMED'::order_status, ${executionMode}::text,
        ${executionMode === "AUTO_SIMULATE" ? new Date() : null}::timestamptz, false, ${tick.source}::text,
        ${tick.quality}::data_quality, ${new Date(tick.observedAt)}::timestamptz,
        ${expiresAt}::timestamptz
      FROM available_balance
      RETURNING id
    `);

    if (!result.rows.length) {
      return Response.json({ detail: "El monto supera el saldo demo disponible." }, { status: 422 });
    }

    return Response.json({ id: (result.rows[0] as { id: string }).id }, { status: 201 });
  } catch (error) {
    console.error("[cauce] no se pudo crear la orden demo", error);
    return Response.json({
      detail: developmentError(error)
        ?? "No se pudo crear la orden. Revisá la cotización y la conexión con la base de datos.",
    }, { status: 503 });
  }
}
