import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local automatically; Drizzle Kit does not.
loadEnv({ path: [".env.local", ".env"] });

const isMigrationCommand = process.argv.some((argument) => argument === "migrate");
const directUrl = process.env.DATABASE_URL_UNPOOLED;

if (isMigrationCommand && !directUrl) {
  throw new Error("Definí DATABASE_URL_UNPOOLED con la URL directa de Neon antes de ejecutar migraciones.");
}

if (isMigrationCommand && directUrl && new URL(directUrl).hostname.includes("-pooler")) {
  throw new Error("DATABASE_URL_UNPOOLED está usando un host -pooler. Copiá la URL Direct (sin pooler) desde Neon.");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl ?? process.env.DATABASE_URL!,
  },
  strict: false,
  verbose: true,
});
