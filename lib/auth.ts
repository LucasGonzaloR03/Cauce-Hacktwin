import "server-only";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";

export const AUTH_TOKEN_MINUTES = 10;
export const AUTH_CHALLENGE_MINUTES = 5;

export function normalizedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function randomAuthToken() {
  return randomBytes(32).toString("base64url");
}

export function configuredOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("Definí NEXT_PUBLIC_APP_URL antes de habilitar autenticación en producción.");
  }
  const parsed = new URL(configured || request.url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL debe usar http:// o https://.");
  }
  return parsed.origin;
}

export function isSameOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const sourceHeader = originHeader && originHeader !== "null" ? originHeader : refererHeader;
  if (!sourceHeader) return false;

  try {
    const sourceUrl = new URL(sourceHeader);
    if (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:") return false;
    const sourceOrigin = sourceUrl.origin;
    const allowedOrigins = new Set<string>();
    const addAllowedOrigin = (value: string) => {
      try {
        const parsed = new URL(value);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") allowedOrigins.add(parsed.origin);
      } catch {
        // Un NEXT_PUBLIC_APP_URL inválido no debe impedir requests same-origin al host actual.
      }
    };
    addAllowedOrigin(request.url);

    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) addAllowedOrigin(configured);

    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (forwardedHost) {
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
        || new URL(request.url).protocol.replace(":", "");
      addAllowedOrigin(`${forwardedProto}://${forwardedHost}`);
    }

    return allowedOrigins.has(sourceOrigin);
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function magicLinkHtml(url: string, logoSrc: string) {
  const safeUrl = escapeHtml(url);
  const safeLogoSrc = escapeHtml(logoSrc);
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"></head>
  <body style="margin:0;padding:0;background:#f1f0ed;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f0ed;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#fff;border:1px solid #dedbd5;">
          <tr><td style="padding:28px 32px 22px;border-bottom:1px solid #e7e4df;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
              <td valign="middle"><img src="${safeLogoSrc}" width="48" height="48" alt="Símbolo de Cauce" style="display:block;width:48px;height:48px;border:0;border-radius:8px;"></td>
              <td valign="middle" style="padding-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:1;color:#171717;">Cauce</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:34px 32px 28px;">
            <p style="margin:0 0 12px;font-size:11px;line-height:1.4;font-weight:bold;letter-spacing:1.6px;color:#8a4b37;">ACCESO SEGURO</p>
            <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:31px;line-height:1.12;font-weight:normal;color:#171717;">Confirmá tu acceso</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#55524e;">Usá este enlace para entrar a Cauce y continuar con tu cuenta. Si no pediste este acceso, podés ignorar el correo.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;"><tr>
              <td bgcolor="#171717" style="border-radius:4px;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border:1px solid #171717;border-radius:4px;color:#fff;text-decoration:none;font-size:14px;line-height:1.2;font-weight:bold;">Confirmar acceso</a>
              </td>
            </tr></table>
            <p style="margin:0;padding:12px 14px;border:1px solid #e7e4df;background:#f8f7f5;font-size:12px;line-height:1.5;color:#55524e;">Este enlace vence en <strong style="color:#171717;">10 minutos</strong> y se puede usar una sola vez.</p>
            <p style="margin:22px 0 7px;font-size:11px;line-height:1.5;color:#77736d;">Si el botón no funciona, copiá este enlace en tu navegador:</p>
            <p style="margin:0;word-break:break-all;font-size:11px;line-height:1.6;color:#55524e;">${safeUrl}</p>
          </td></tr>
          <tr><td style="padding:17px 32px;border-top:1px solid #e7e4df;background:#faf9f7;">
            <p style="margin:0;font-size:11px;line-height:1.5;color:#77736d;">Cauce · Tu dinero, a tu ritmo.</p>
            <p style="margin:5px 0 0;font-size:10px;line-height:1.5;color:#99958e;">Este mensaje es automático y no recibe respuestas.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendMagicLink(email: string, url: string) {
  const mode = process.env.AUTH_EMAIL_MODE ?? "sandbox";
  if (mode === "sandbox") return "sandbox" as const;
  if (mode === "gmail") {
    const user = process.env.GMAIL_USER;
    const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
    if (!user || !appPassword) throw new Error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD.");
    const logo = await readFile(join(process.cwd(), "public", "email", "cauce-symbol.png"));
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass: appPassword } });
    await transporter.sendMail({
      from: { name: "Cauce", address: user },
      to: email,
      subject: "Tu acceso a Cauce",
      text: `Abrí Cauce y confirmá tu acceso: ${url}\n\nEl enlace vence en 10 minutos y se usa una sola vez.`,
      html: magicLinkHtml(url, "cid:cauce-symbol"),
      attachments: [{ filename: "cauce-symbol.png", content: logo, contentType: "image/png", cid: "cauce-symbol", contentDisposition: "inline" }],
    });
    return "sent" as const;
  }
  if (mode !== "resend") throw new Error("AUTH_EMAIL_MODE debe ser sandbox, gmail o resend.");
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!key || !from) throw new Error("Faltan RESEND_API_KEY o AUTH_EMAIL_FROM para enviar correo.");
  const logoUrl = new URL("/email/cauce-symbol.png", new URL(url).origin).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Tu acceso a Cauce",
      text: `Abrí Cauce y confirmá tu acceso: ${url}\n\nEl enlace vence en 10 minutos y se usa una sola vez.`,
      html: magicLinkHtml(url, logoUrl),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("El proveedor de correo rechazó el envío.");
  return "sent" as const;
}
