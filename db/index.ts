import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta DATABASE_URL. Copiá .env.local o configurá la variable en Vercel.");
}

const client = neon(connectionString);

export const db = drizzle({ client, schema });
export { schema };
