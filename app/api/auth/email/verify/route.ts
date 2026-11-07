import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { rotateSessionFor, hashToken } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const { token } = await request.json();
    if (typeof token !== "string" || token.length > 128) return Response.json({ detail: "Enlace inválido o vencido." }, { status: 400 });
    const claimed = await db.update(authTokens).set({ usedAt: new Date() })
      .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.purpose, "magic_link"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
      .returning({ userId: authTokens.userId, email: authTokens.email });
    if (!claimed[0]?.userId) return Response.json({ detail: "Enlace inválido, usado o vencido." }, { status: 400 });
    const [targetUser] = await db.select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
      .from(users).where(eq(users.id, claimed[0].userId)).limit(1);
    if (!targetUser) return Response.json({ detail: "No se encontró la cuenta para este enlace." }, { status: 409 });
    const wasExistingAccount = Boolean(targetUser.emailVerifiedAt && targetUser.email === claimed[0].email);
    const updated = await db.update(users).set({ email: claimed[0].email, emailVerifiedAt: new Date() })
      .where(eq(users.id, claimed[0].userId)).returning({ id: users.id });
    if (!updated.length) return Response.json({ detail: "No se pudo vincular el email." }, { status: 409 });
    await rotateSessionFor(updated[0].id, request.headers.get("user-agent"));
    return Response.json({ ok: true, intent: wasExistingAccount ? "login" : "link" });
  } catch (error) {
    console.error("[cauce] no se pudo verificar el enlace", error);
    return Response.json({ detail: "Ese email ya está vinculado a otra cuenta o el enlace venció." }, { status: 409 });
  }
}
