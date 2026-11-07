import "server-only";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { demoOrders, type DemoOrder } from "@/db/schema";
import { getTick } from "@/lib/fx";
import { configuredOrigin, sendOrderPriceAlert } from "@/lib/auth";

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export type OrderForEvaluation = {
  order: DemoOrder;
  email: string | null;
  emailVerifiedAt: Date | null;
};

export type OrderEvaluationResult = {
  checked: number;
  triggered: number;
  expired: number;
  skipped: number;
};

/** Evaluates armed orders using one live quote, whether invoked by UI polling or cron. */
export async function evaluateDemoOrders(
  entries: OrderForEvaluation[],
  request: Request,
): Promise<OrderEvaluationResult> {
  const result: OrderEvaluationResult = { checked: 0, triggered: 0, expired: 0, skipped: 0 };
  if (!entries.length) return result;

  const now = Date.now();
  const active: OrderForEvaluation[] = [];
  for (const entry of entries) {
    if (entry.order.expiresAt && entry.order.expiresAt.getTime() <= now) {
      const expired = await db.execute(sql`
        WITH expired_order AS (
          UPDATE demo_orders
          SET status = 'EXPIRED'
          WHERE id = ${entry.order.id}::uuid
            AND user_id = ${entry.order.userId}::uuid
            AND status = 'ARMED'
            AND expires_at <= now()
          RETURNING user_id, amount_ars_minor, is_mock
        ), refunded AS (
          UPDATE users
          SET demo_balance_minor = demo_balance_minor + expired_order.amount_ars_minor
          FROM expired_order
          WHERE users.id = expired_order.user_id AND expired_order.is_mock = false
        )
        SELECT user_id FROM expired_order
      `);
      if (expired.rows.length) result.expired += 1;
      continue;
    }
    active.push(entry);
  }

  if (!active.length) return result;
  let tick;
  try {
    tick = await getTick("USDT/ARS");
  } catch (error) {
    console.error("[cauce] no se pudo obtener el precio para evaluar órdenes", error);
    result.skipped = active.length;
    return result;
  }
  if (tick.quality !== "live") {
    result.skipped = active.length;
    return result;
  }

  const observedAt = new Date(tick.observedAt);
  const rate = Number(tick.ask ?? tick.last);
  if (!Number.isFinite(rate) || rate <= 0) {
    result.skipped = active.length;
    return result;
  }

  for (const { order, email, emailVerifiedAt } of active) {
    const nextConfirmCount = rate <= Number(order.targetRate) ? order.confirmCount + 1 : 0;
    const triggered = nextConfirmCount >= 2;
    const nextStatus: DemoOrder["status"] = triggered
      ? order.executionMode === "AUTO_SIMULATE" ? "SETTLED" : "TRIGGERED"
      : "ARMED";

    const updated = await db.update(demoOrders).set({
      status: nextStatus,
      confirmCount: nextConfirmCount,
      lastObservedAt: observedAt,
      triggeredRate: triggered ? String(rate) : order.triggeredRate,
      filledRate: triggered && order.executionMode === "AUTO_SIMULATE" ? String(rate) : order.filledRate,
      executedAt: triggered && order.executionMode === "AUTO_SIMULATE" ? new Date() : order.executedAt,
    }).where(and(
      eq(demoOrders.id, order.id),
      eq(demoOrders.userId, order.userId),
      eq(demoOrders.status, "ARMED"),
      or(sql`${demoOrders.lastObservedAt} IS NULL`, lt(demoOrders.lastObservedAt, observedAt)),
    )).returning({ id: demoOrders.id });

    if (!updated.length) continue;
    result.checked += 1;
    if (!triggered) continue;
    result.triggered += 1;

    if (nextStatus === "TRIGGERED" && email && emailVerifiedAt) {
      try {
        const ordersUrl = new URL("/ordenes", configuredOrigin(request)).toString();
        await sendOrderPriceAlert(email, {
          amount: arsFormatter.format(order.amountArsMinor / 100),
          targetRate: arsFormatter.format(Number(order.targetRate)),
          observedRate: arsFormatter.format(rate),
          ordersUrl,
        });
      } catch (emailError) {
        // El estado de la orden queda actualizado y visible en la app aunque el mail falle.
        console.error(`[cauce] no se pudo enviar el aviso de precio para la orden ${order.id}`, emailError);
      }
    }
  }

  return result;
}
