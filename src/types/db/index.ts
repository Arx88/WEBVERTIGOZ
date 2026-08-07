/**
 * Tipo placeholder de la DB de Supabase.
 * Cuando Supabase esté conectado, generar el tipo real con:
 *   npx supabase gen types typescript --project-id <id> > src/types/db/index.ts
 */

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
