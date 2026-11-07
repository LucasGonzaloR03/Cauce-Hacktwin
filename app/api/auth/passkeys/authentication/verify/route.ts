import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authChallenges, passkeyCredentials } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { rotateSessionFor } from "@/lib/session";
import { webAuthnConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const { response } = await request.json();
    const clientData = Buffer.from(response?.response?.clientDataJSON ?? "", "base64url").toString("utf8");
    const clientChallenge = JSON.parse(clientData).challenge as string;
    const claimed = await db.update(authChallenges).set({ usedAt: new Date() })
      .where(and(eq(authChallenges.challenge, clientChallenge), eq(authChallenges.purpose, "passkey_auth"), isNull(authChallenges.usedAt), gt(authChallenges.expiresAt, new Date())))
      .returning({ challenge: authChallenges.challenge });
    if (!claimed.length) return Response.json({ detail: "El desafío venció o ya fue usado." }, { status: 400 });
    const [credential] = await db.select().from(passkeyCredentials).where(eq(passkeyCredentials.credentialId, response.id)).limit(1);
    if (!credential) return Response.json({ detail: "No se encontró esa passkey." }, { status: 401 });
    const config = webAuthnConfig(request);
    const verification = await verifyAuthenticationResponse({
      response, expectedChallenge: claimed[0].challenge, expectedOrigin: config.origin, expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: { id: credential.credentialId, publicKey: Buffer.from(credential.publicKey, "base64url"), counter: credential.counter, transports: credential.transports as never },
    });
    if (!verification.verified) return Response.json({ detail: "No se pudo verificar la passkey." }, { status: 401 });
    await db.update(passkeyCredentials).set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeyCredentials.id, credential.id));
    await rotateSessionFor(credential.userId, request.headers.get("user-agent"));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[cauce] no se pudo verificar passkey", error);
    return Response.json({ detail: "No se pudo completar el acceso con passkey." }, { status: 400 });
  }
}
