import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { clearSessionCookie, readSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const session = await readSession();
    if (session) await db.delete(sessions).where(eq(sessions.id, session.sessionId));
    await clearSessionCookie();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "No se pudo cerrar la sesión." }, { status: 503 });
  }
}
