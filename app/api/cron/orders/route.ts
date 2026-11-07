import { timingSafeEqual } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { demoOrders, users } from "@/db/schema";
import { evaluateDemoOrders } from "@/lib/orders/evaluate";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 250;

function hasValidCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expectedHeader);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[cauce] falta configurar CRON_SECRET para evaluar órdenes programadas");
    return Response.json({ detail: "La tarea programada no está configurada." }, { status: 503 });
  }
  if (!hasValidCronSecret(request)) {
    return Response.json({ detail: "No autorizado." }, { status: 401 });
  }

  try {
    const pending = await db.select({
      order: demoOrders,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
    })
      .from(demoOrders)
      .innerJoin(users, eq(users.id, demoOrders.userId))
      .where(and(eq(demoOrders.status, "ARMED"), eq(demoOrders.isMock, false)))
      .orderBy(asc(demoOrders.lastObservedAt), asc(demoOrders.createdAt))
      .limit(BATCH_SIZE);

    const result = await evaluateDemoOrders(pending, request);
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[cauce] falló la evaluación programada de órdenes", error);
    return Response.json({ detail: "No se pudieron evaluar las órdenes." }, { status: 503 });
  }
}
