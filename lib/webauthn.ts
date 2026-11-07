import "server-only";

export function webAuthnConfig(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("Definí NEXT_PUBLIC_APP_URL antes de habilitar passkeys en producción.");
  }
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  const rpID = process.env.WEBAUTHN_RP_ID || new URL(origin).hostname;
  return { origin, rpID, rpName: "Cauce" };
}

export function challengeExpiry() {
  return new Date(Date.now() + 5 * 60_000);
}
