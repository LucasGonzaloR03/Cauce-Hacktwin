import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/db";
import { authChallenges } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { challengeExpiry, webAuthnConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ detail: "Origen no permitido." }, { status: 403 });
  try {
    const config = webAuthnConfig(request);
    const options = await generateAuthenticationOptions({ rpID: config.rpID, userVerification: "required" });
    await db.insert(authChallenges).values({ challenge: options.challenge, purpose: "passkey_auth", expiresAt: challengeExpiry() });
    return Response.json(options, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cauce] no se pudo iniciar autenticación passkey", error);
    return Response.json({ detail: "No se pudo iniciar el acceso con passkey." }, { status: 400 });
  }
}
