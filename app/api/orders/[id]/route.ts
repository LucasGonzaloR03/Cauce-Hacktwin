import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getOrCreateUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return Response.json({ detail: "La orden indicada no es válida." }, { status: 400 });

  try {
    const { user } = await getOrCreateUser(request.headers.get("user-agent"));
    const result = await db.execute(sql`
      WITH deleted_order AS (
        DELETE FROM demo_orders
        WHERE id = ${id}::uuid AND user_id = ${user.id}::uuid
        RETURNING id, amount_ars_minor, is_mock
      ), refunded_balance AS (
        UPDATE users
        SET demo_balance_minor = demo_balance_minor + deleted_order.amount_ars_minor
        FROM deleted_order
        WHERE users.id = ${user.id}::uuid AND deleted_order.is_mock = false
        RETURNING users.id
      )
      SELECT id FROM deleted_order
    `);

    if (!result.rows.length) return Response.json({ detail: "No se encontró esa orden." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("[cauce] no se pudo eliminar la orden demo", error);
    return Response.json({ detail: "No se pudo eliminar la orden." }, { status: 503 });
  }
}