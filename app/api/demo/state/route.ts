import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { demoTransfers } from "@/db/schema";
import { getOrCreateUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export async function GET(request: Request) {
  try {
    const { user } = await getOrCreateUser(request.headers.get("user-agent"));
    const rows = await db
      .select({ result: demoTransfers.result, balanceAfterMinor: demoTransfers.balanceAfterMinor })
      .from(demoTransfers)
      .where(eq(demoTransfers.userId, user.id))
      .orderBy(desc(demoTransfers.createdAt))
      .limit(10);

    return Response.json({
      balance: {
        amount: user.demoBalanceMinor / 100,
        formatted: arsFormatter.format(user.demoBalanceMinor / 100),
      },
      simulations: rows.map(({ result, balanceAfterMinor }) => ({
        ...result,
        balanceAfterArs: balanceAfterMinor / 100,
        balanceAfterFormatted: arsFormatter.format(balanceAfterMinor / 100),
      })),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[cauce] no se pudo cargar el estado demo", error);
    return Response.json({
      detail: process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "No se pudo cargar el estado demo.",
    }, { status: 503 });
  }
}