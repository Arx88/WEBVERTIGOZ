import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cliente Drizzle para Postgres (Supabase).
 * Singleton a nivel de módulo para evitar reconexiones en dev.
 */

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function getClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no configurada. Ver .env.example");
  }
  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return client;
}

export function getDb() {
  if (!db) {
    db = drizzle(getClient(), { schema });
  }
  return db;
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export { schema };
