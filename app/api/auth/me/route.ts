import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // No crear sesiones desde este endpoint: el estado demo es quien inicializa
    // la cookie y evita que dos GET paralelos creen usuarios anónimos distintos.
    const session = await readSession();
    const user = session?.user;
    return Response.json({
      linked: Boolean(user?.emailVerifiedAt),
      email: user?.emailVerifiedAt ? user.email : null,
      demo: true,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "No se pudo cargar tu cuenta." }, { status: 503 });
  }
}
