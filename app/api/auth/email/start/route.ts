import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { configuredOrigin, isSameOrigin, normalizedEmail, randomAuthToken, sendMagicLink } from "@/lib/auth";
import { getOrCreateUser, hashToken } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const body = await request.json();
    const email = normalizedEmail(body?.email);
    if (!email) return Response.json({ detail: "Ingresá un email válido." }, { status: 400 });
    if (process.env.NODE_ENV === "production" && (process.env.AUTH_EMAIL_MODE ?? "sandbox") === "sandbox") {
      return Response.json({ detail: "El acceso por email no está habilitado en producción." }, { status: 503 });
    }
    const { user: currentUser } = await getOrCreateUser(request.headers.get("user-agent"));
    const [existingAccount] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.email, email), isNotNull(users.emailVerifiedAt))).limit(1);
    const targetUserId = existingAccount?.id ?? currentUser.id;
    const recent = await db.select({ id: authTokens.id }).from(authTokens)
      .where(and(eq(authTokens.email, email), gt(authTokens.createdAt, new Date(Date.now() - 60_000))))
      .limit(1);
    if (recent.length) return Response.json({ detail: "Esperá un minuto antes de pedir otro enlace." }, { status: 429 });
    const token = randomAuthToken();
    await db.insert(authTokens).values({
      userId: targetUserId, email, tokenHash: hashToken(token), purpose: "magic_link",
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const url = new URL("/acceso", configuredOrigin(request));
    url.hash = new URLSearchParams({ token }).toString();
    const mode = await sendMagicLink(email, url.toString());
    return Response.json({ mode, ...(mode === "sandbox" ? { previewUrl: url.toString() } : {}) });
  } catch (error) {
    console.error("[cauce] no se pudo iniciar acceso por email", error);
    return Response.json({ detail: "No se pudo enviar el enlace. Revisá la configuración de correo." }, { status: 503 });
  }
}
