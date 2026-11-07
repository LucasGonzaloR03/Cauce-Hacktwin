import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { ProblemError } from "./problem";

export const SESSION_COOKIE = "cauce_session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type SessionContext = {
  user: User;
  sessionId: string;
  token: string;
  created: boolean;
};

async function createSession(userId: string, userAgent?: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  const [session] = await db
    .insert(sessions)
    .values({ userId, tokenHash: hashToken(token), expiresAt, userAgent })
    .returning();
  return { session, token };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set({ name: SESSION_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 });
}

async function sessionFromToken(token: string | undefined) {
  if (!token) return null;
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows.length) return null;
  return { session: rows[0].session, user: rows[0].user, token };
}

/** Lee la sesión sin crear nada. Sirve para pantallas públicas. */
export async function readSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const found = await sessionFromToken(token);
  if (!found) return null;
  return { ...found, sessionId: found.session.id, created: false };
}

export async function requireUser(): Promise<SessionContext> {
  const session = await readSession();
  if (!session) throw new ProblemError("UNAUTHORIZED", "Abrí la app de nuevo para crear una sesión.");
  return session;
}

/**
 * Crea usuario anónimo + sesión si no hay cookie válida. Pensada para Route
 * Handlers: `cookies().set` funciona ahí y en Server Actions, no en Server
 * Components.
 */
export async function getOrCreateUser(userAgent?: string | null): Promise<SessionContext> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const found = await sessionFromToken(token);
  if (found) return { ...found, sessionId: found.session.id, created: false };

  const [user] = await db.insert(users).values({ anonTokenHash: token ? hashToken(token) : null }).returning();
  const { session, token: fresh } = await createSession(user.id, userAgent);
  await db.update(users).set({ anonTokenHash: hashToken(fresh) }).where(eq(users.id, user.id));
  await setSessionCookie(fresh);
  return { user, sessionId: session.id, token: fresh, created: true };
}

/** Reemplaza la sesión actual por una nueva del usuario indicado. */
export async function rotateSessionFor(userId: string, userAgent?: string | null) {
  const current = await readSession();
  if (current) {
    await db.delete(sessions).where(eq(sessions.id, current.sessionId));
  }
  const { token } = await createSession(userId, userAgent);
  await setSessionCookie(token);
  return token;
}
