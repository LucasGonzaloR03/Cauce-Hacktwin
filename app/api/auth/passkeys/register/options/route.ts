import { generateRegistrationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authChallenges, passkeyCredentials } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { challengeExpiry, webAuthnConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const { user } = await requireUser();
    if (!user.emailVerifiedAt || !user.email) return Response.json({ detail: "Vinculá y verificá tu email primero." }, { status: 403 });
    const config = webAuthnConfig(request);
    const existing = await db.select({ credentialId: passkeyCredentials.credentialId }).from(passkeyCredentials).where(eq(passkeyCredentials.userId, user.id));
    const options = await generateRegistrationOptions({
      rpName: config.rpName, rpID: config.rpID, userName: user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: existing.map((item) => ({ id: item.credentialId })),
    });
    await db.insert(authChallenges).values({ userId: user.id, challenge: options.challenge, purpose: "passkey_register", expiresAt: challengeExpiry() });
    return Response.json(options, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cauce] no se pudo iniciar alta de passkey", error);
    return Response.json({ detail: "No se pudo iniciar la verificación biométrica." }, { status: 400 });
  }
}
