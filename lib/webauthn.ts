import "server-only";

export function webAuthnConfig(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configuredUrl) {
    throw new Error("Definí NEXT_PUBLIC_APP_URL antes de habilitar passkeys en producción.");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl || request.url);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL debe ser una URL absoluta con http:// o https://.");
    }
    baseUrl = new URL(request.url);
  }

  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL debe usar http:// o https://.");
  }

  const origin = baseUrl.origin;
  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || baseUrl.hostname;
  return { origin, rpID, rpName: "Cauce" };
}

export function challengeExpiry() {
  return new Date(Date.now() + 5 * 60_000);
}
