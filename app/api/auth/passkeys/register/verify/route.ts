import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authChallenges, passkeyCredentials } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { webAuthnConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const { user } = await requireUser();
    const { response } = await request.json();
    const challenge = typeof response?.response?.clientDataJSON === "string" ? (await import("node:buffer")).Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8") : "";
    const clientChallenge = challenge ? JSON.parse(challenge).challenge : null;
    if (!clientChallenge) return Response.json({ detail: "Respuesta passkey inválida." }, { status: 400 });
    const claimed = await db.update(authChallenges).set({ usedAt: new Date() })
      .where(and(eq(authChallenges.challenge, clientChallenge), eq(authChallenges.userId, user.id), eq(authChallenges.purpose, "passkey_register"), isNull(authChallenges.usedAt), gt(authChallenges.expiresAt, new Date())))
      .returning({ challenge: authChallenges.challenge });
    if (!claimed.length) return Response.json({ detail: "El desafío venció o ya fue usado." }, { status: 400 });
    const config = webAuthnConfig(request);
    const verification = await verifyRegistrationResponse({ response, expectedChallenge: claimed[0].challenge, expectedOrigin: config.origin, expectedRPID: config.rpID, requireUserVerification: true });
    if (!verification.verified || !verification.registrationInfo) return Response.json({ detail: "No se pudo verificar la passkey." }, { status: 400 });
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await db.insert(passkeyCredentials).values({
      userId: user.id, credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter,
      transports: credential.transports ?? [], deviceType: credentialDeviceType, backedUp: credentialBackedUp,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[cauce] no se pudo registrar passkey", error);
    return Response.json({ detail: "No se pudo registrar la passkey." }, { status: 400 });
  }
}
