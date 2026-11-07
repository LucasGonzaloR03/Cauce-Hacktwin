import "server-only";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderEvents,
  orders,
  quotes,
  users,
  type Order,
  type OrderStatus,
} from "@/db/schema";
import { getCorridor } from "./config";
import { getTick, pairFor } from "./fx";
import { assetMeta, formatMoney, formatRate } from "./money";
import { createQuote } from "./quote";

const ACTIVE: OrderStatus[] = ["ARMED", "TRIGGERED", "QUOTED", "EXECUTING"];
const CONFIRMATIONS_REQUIRED = 2;
const MAX_ATTEMPTS = 3;

export function isActive(status: OrderStatus) {
  return ACTIVE.includes(status);
}

export function meetsCondition(condition: string, rate: number, target: number) {
  return condition === "rate_gte" ? rate >= target : rate <= target;
}

export function worseSlippageBps(buy: boolean, fillRate: number, targetRate: number) {
  if (targetRate <= 0) return 0;
  const worse = buy ? fillRate - targetRate : targetRate - fillRate;
  return Math.max(0, Math.round((worse / targetRate) * 10_000));
}

export function computeSavingsMinor(params: {
  buy: boolean;
  referenceRate: number;
  filledRate: number;
  amountAssetMinor: number;
  assetCode: string;
  rateCurrency: string;
}): number {
  const { buy, referenceRate, filledRate, amountAssetMinor, assetCode, rateCurrency } = params;
  const diff = buy ? referenceRate - filledRate : filledRate - referenceRate;
  if (diff <= 0) return 0;
  const assetDec = assetMeta(assetCode).storageDecimals;
  const rateDec = assetMeta(rateCurrency).storageDecimals;
  return Math.round((amountAssetMinor * diff * 10 ** rateDec) / 10 ** assetDec);
}

export async function appendEvent(params: {
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  message: string;
  reasonCode?: string;
  rate?: number;
  quoteId?: string | null;
  actor?: "system" | "user" | "cron";
  traceId?: string | null;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await db
      .select({ maxSeq: sql<number>`coalesce(max(${orderEvents.seq}), 0)` })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, params.orderId));
    const seq = Number(row?.maxSeq ?? 0) + 1 + attempt;
    try {
      await db.insert(orderEvents).values({
        orderId: params.orderId,
        seq,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        reasonCode: params.reasonCode ?? null,
        message: params.message,
        rateAtEvent: params.rate != null ? String(params.rate) : null,
        quoteId: params.quoteId ?? null,
        actor: params.actor ?? "system",
        traceId: params.traceId ?? null,
      });
      return;
    } catch (error) {
      if (attempt === 2) console.warn("[cauce] no se pudo escribir el evento", error);
    }
  }
}

export async function transitionOrder(
  order: Order,
  to: OrderStatus,
  patch: Partial<Order>,
  message: string,
  options: { reasonCode?: string; rate?: number; quoteId?: string | null; actor?: "system" | "user" | "cron" } = {},
): Promise<Order | null> {
  const [updated] = await db
    .update(orders)
    .set({ ...patch, status: to, version: order.version + 1 })
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status), eq(orders.version, order.version)))
    .returning();

  if (!updated) return null;

  await appendEvent({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: to,
    message,
    reasonCode: options.reasonCode,
    rate: options.rate,
    quoteId: options.quoteId,
    actor: options.actor,
  });

  return updated;
}

async function resetConfirmation(order: Order) {
  if (order.confirmCount === 0) return order;
  const [updated] = await db
    .update(orders)
    .set({ confirmCount: 0, version: order.version + 1 })
    .where(and(eq(orders.id, order.id), eq(orders.version, order.version)))
    .returning();
  return updated ?? order;
}

async function getOrderRow(id: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

function describeRate(rate: number, currency: string) {
  return formatRate(rate, currency === "MXN" ? "es-MX" : currency === "COP" ? "es-CO" : "es-AR");
}

/**
 * Avanza una orden hasta donde el estado actual permita. Cada paso usa
 * concurrencia optimista: si otro request ganó la transición, se relee y se
 * sigue. Como máximo 5 transiciones por llamada para no quedarse en un loop.
 */
export async function advanceOrder(orderId: string, actor: "system" | "user" | "cron" = "system") {
  let order = await getOrderRow(orderId);
  if (!order) return null;

  for (let step = 0; step < 5; step++) {
    // Another request can remove the order while a transition is being retried.
    if (!order) return null;
    if (!isActive(order.status)) return order;

    const corridor = await getCorridor(order.corridorId);
    if (!corridor) return order;

    const pair = pairFor(order.assetCode, order.rateCurrency);
    const tick = await getTick(pair).catch(() => null);
    if (!tick) return order;
    const rate = Number(tick.last);
    const target = Number(order.targetRate);
    const buy = order.fromAsset === order.rateCurrency;

    if (order.status === "ARMED") {
      if (new Date(order.expiresAt).getTime() <= Date.now()) {
        const moved = await transitionOrder(
          order,
          "EXPIRED",
          { failureReason: "ORDER_EXPIRED" },
          "La orden venció sin que el precio llegara al objetivo.",
          { reasonCode: "ORDER_EXPIRED", actor },
        );
        if (!moved) {
          order = await getOrderRow(orderId);
          continue;
        }
        await refundReservation(moved);
        return moved;
      }

      if (!meetsCondition(order.condition, rate, target)) {
        order = await resetConfirmation(order);
        return order;
      }

      if (order.confirmCount + 1 < CONFIRMATIONS_REQUIRED) {
        const updatedRows: Order[] = await db
          .update(orders)
          .set({ confirmCount: order.confirmCount + 1, version: order.version + 1 })
          .where(and(eq(orders.id, order.id), eq(orders.version, order.version)))
          .returning();
        const updated: Order | undefined = updatedRows[0];
        order = updated ?? (await getOrderRow(orderId));
        if (!updated) continue;
        return order;
      }

      const moved = await transitionOrder(
        order,
        "TRIGGERED",
        { triggeredRate: String(rate), confirmCount: CONFIRMATIONS_REQUIRED },
        `El precio tocó el objetivo dos veces seguidas (${describeRate(rate, order.rateCurrency)}).`,
        { reasonCode: "TARGET_REACHED", rate, actor },
      );
      if (!moved) {
        order = await getOrderRow(orderId);
        continue;
      }
      order = moved;
      continue;
    }

    if (order.status === "TRIGGERED") {
      const slippage = worseSlippageBps(buy, rate, target);
      if (slippage > order.maxSlippageBps) {
        const attempts = order.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          const moved = await transitionOrder(
            order,
            "FAILED",
            { failureReason: "SLIPPAGE_EXCEEDED", attempts, slippageRealBps: slippage },
            `El precio se movió ${(slippage / 100).toFixed(2)}% y superó el tope de ${(order.maxSlippageBps / 100).toFixed(2)}%. Se agotaron los reintentos.`,
            { reasonCode: "SLIPPAGE_EXCEEDED", rate, actor },
          );
          if (!moved) {
            order = await getOrderRow(orderId);
            continue;
          }
          await refundReservation(moved);
          return moved;
        }
        const moved = await transitionOrder(
          order,
          "ARMED",
          {
            attempts,
            confirmCount: 0,
            slippageRealBps: slippage,
            nextRetryAt: new Date(Date.now() + 5_000 * attempts),
          },
          `El precio se movió ${(slippage / 100).toFixed(2)}% (tope ${(order.maxSlippageBps / 100).toFixed(2)}%). La orden sigue armada.`,
          { reasonCode: "SLIPPAGE_RETRY", rate, actor },
        );
        if (!moved) {
          order = await getOrderRow(orderId);
          continue;
        }
        order = moved;
        continue;
      }

      const { createQuote } = await import("./quote");
      const fresh = await createQuote({
        userId: order.userId,
        corridor,
        amountInMinor: order.reservedAmountMinor,
      });
      const moved = await transitionOrder(
        order,
        "QUOTED",
        { quoteId: fresh.id },
        `Cotización nueva por ${corridor.quoteTtlSeconds} s a ${describeRate(Number(fresh.effectiveRate), order.rateCurrency)}.`,
        { reasonCode: "QUOTE_CREATED", rate, quoteId: fresh.id, actor },
      );
      if (!moved) {
        order = await getOrderRow(orderId);
        continue;
      }
      order = moved;
      continue;
    }

    if (order.status === "QUOTED") {
      const moved = await transitionOrder(order, "EXECUTING", {}, "Ejecutando con el precio confirmado.", {
        reasonCode: "EXECUTION_STARTED",
        rate,
        actor,
      });
      if (!moved) {
        order = await getOrderRow(orderId);
        continue;
      }
      order = moved;
      continue;
    }

    if (order.status === "EXECUTING") {
      const filledRate = rate;
      const referenceRate = Number(order.referenceRate);
      const assetAmountMinor = buy ? order.amountOutMinor : order.amountInMinor;
      const savings = computeSavingsMinor({
        buy,
        referenceRate,
        filledRate,
        amountAssetMinor: assetAmountMinor,
        assetCode: order.assetCode,
        rateCurrency: order.rateCurrency,
      });
      const moved = await transitionOrder(
        order,
        "SETTLED",
        { filledRate: String(filledRate), savingsMinor: savings, executedAt: new Date(), slippageRealBps: worseSlippageBps(buy, filledRate, target) },
        savings > 0
          ? `Ejecutada a ${describeRate(filledRate, order.rateCurrency)}. Ahorro vs. hoy: ${formatMoney(savings, order.rateCurrency, "es-AR")}.`
          : `Ejecutada a ${describeRate(filledRate, order.rateCurrency)}.`,
        { reasonCode: "SETTLED", rate: filledRate, actor },
      );
      if (!moved) {
        order = await getOrderRow(orderId);
        continue;
      }
      return moved;
    }
  }

  return order;
}

export async function refundReservation(order: Order) {
  if (order.reservedAmountMinor <= 0) return;
  if (order.fromAsset !== "USD") return;
  try {
    await db
      .update(users)
      .set({ demoBalanceMinor: sql`${users.demoBalanceMinor} + ${order.reservedAmountMinor}` })
      .where(eq(users.id, order.userId));
  } catch (error) {
    console.warn("[cauce] no se pudo devolver el saldo reservado", error);
  }
}

export async function advanceUserOrders(userId: string) {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, userId), inArray(orders.status, ACTIVE)))
    .limit(20);
  for (const row of rows) {
    await advanceOrder(row.id, "system");
  }
}

export async function advanceAllOrders(limit = 100) {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(inArray(orders.status, ACTIVE))
    .limit(limit);
  let evaluated = 0;
  let settled = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const result = await advanceOrder(row.id, "cron");
      evaluated++;
      if (result?.status === "SETTLED") settled++;
    } catch (error) {
      errors++;
      console.warn("[cauce] tick falló", row.id, error);
    }
  }
  return { evaluated, settled, errors };
}

export async function getOrderWithEvents(orderId: string, userId?: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return null;
  if (userId && order.userId !== userId) return null;
  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(orderEvents.seq);
  return { order, events };
}

export async function getQuoteForOrder(orderId: string) {
  const rows = await db
    .select({ quote: quotes })
    .from(orders)
    .innerJoin(quotes, eq(quotes.id, orders.quoteId))
    .where(eq(orders.id, orderId))
    .limit(1);
  return rows[0]?.quote ?? null;
}
