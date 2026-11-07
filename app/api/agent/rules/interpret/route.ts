import { interpretRule } from "@/lib/agent/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 8;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function isRateLimited(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip") || forwarded || "unknown";
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    if (requestWindows.size > 2_000) {
      for (const [key, value] of requestWindows) {
        if (now - value.startedAt >= WINDOW_MS) requestWindows.delete(key);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > REQUESTS_PER_WINDOW;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return Response.json(
      { detail: "Llegaste al límite de consultas. Esperá un minuto y volvé a intentar." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_096) {
    return Response.json({ detail: "El pedido supera el tamaño permitido." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_096) {
      return Response.json({ detail: "El pedido supera el tamaño permitido." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ detail: "El pedido no tiene un formato válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("instruction" in body)) {
    return Response.json({ detail: "Falta describir la regla que querés configurar." }, { status: 400 });
  }

  const instruction = (body as { instruction: unknown }).instruction;
  if (typeof instruction !== "string" || instruction.trim().length < 5 || instruction.length > 500) {
    return Response.json({ detail: "Describí la regla en entre 5 y 500 caracteres." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ detail: "El asistente no está configurado en el servidor." }, { status: 503 });
  }

  try {
    const proposal = await interpretRule(instruction.trim());
    return Response.json(
      { proposal, requiresConfirmation: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[cauce] no se pudo interpretar la regla", error instanceof Error ? error.name : "UnknownError");
    return Response.json(
      { detail: "No se pudo interpretar la regla. Revisala o volvé a intentar." },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
