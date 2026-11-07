import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { countries, corridors, settings } from "@/db/schema";
import type { Corridor } from "@/db/schema";

export type Flags = {
  killSwitch: boolean;
  demoMode: boolean;
  consentVersion: string;
  featuredCountry: string;
};

const CACHE_MS = 8_000;
let flagsCache: { at: number; value: Flags } | null = null;
let corridorsCache: { at: number; value: Corridor[] } | null = null;

function envFlags(): Flags {
  return {
    killSwitch: process.env.KILL_SWITCH === "true",
    demoMode: process.env.DEMO_MODE !== "false",
    consentVersion: "1.0",
    featuredCountry: "AR",
  };
}

export async function getFlags(): Promise<Flags> {
  if (flagsCache && Date.now() - flagsCache.at < CACHE_MS) return flagsCache.value;
  const base = envFlags();
  try {
    const rows = await db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
    const value: Flags = {
      killSwitch:
        typeof map.get("kill_switch") === "boolean" ? (map.get("kill_switch") as boolean) : base.killSwitch,
      demoMode: typeof map.get("demo_mode") === "boolean" ? (map.get("demo_mode") as boolean) : base.demoMode,
      consentVersion:
        typeof map.get("consent_version") === "string" ? (map.get("consent_version") as string) : base.consentVersion,
      featuredCountry:
        typeof map.get("featured_country") === "string"
          ? (map.get("featured_country") as string)
          : base.featuredCountry,
    };
    flagsCache = { at: Date.now(), value };
    return value;
  } catch {
    return base;
  }
}

export async function listCorridors(): Promise<Corridor[]> {
  if (corridorsCache && Date.now() - corridorsCache.at < CACHE_MS) return corridorsCache.value;
  const rows = await db
    .select()
    .from(corridors)
    .where(eq(corridors.enabled, true));
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  corridorsCache = { at: Date.now(), value: rows };
  return rows;
}

export async function listCountries() {
  return db.select().from(countries).where(eq(countries.enabled, true)).orderBy(countries.sortOrder);
}

export async function getCorridor(id: string): Promise<Corridor | null> {
  const rows = await db.select().from(corridors).where(and(eq(corridors.id, id), eq(corridors.enabled, true))).limit(1);
  return rows[0] ?? null;
}

export async function findCorridor(countryCode: string, intent: "SEND" | "ACCUMULATE", assetCode: string) {
  const rows = await db
    .select()
    .from(corridors)
    .where(
      and(
        eq(corridors.countryCode, countryCode),
        eq(corridors.intent, intent),
        eq(corridors.assetCode, assetCode),
        eq(corridors.enabled, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export function invalidateConfigCache() {
  flagsCache = null;
  corridorsCache = null;
}
