"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/db";

/**
 * Cliente Supabase para el browser.
 * Singleton a nivel de módulo.
 */

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowser() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Supabase env vars no configuradas");
    }
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
