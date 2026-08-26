/**
 * Tipo permissivo de la DB de Supabase.
 * Cualquier tabla, cualquier columna, cualquier tipo.
 */

type GenericTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: unknown[];
};

export type Database = {
  public: {
    Tables: {
      account: GenericTable;
      team_account: GenericTable;
      tournament_edition: GenericTable;
      tournament_config: GenericTable;
      team_registration: GenericTable;
      player_registration: GenericTable;
      emblem: GenericTable;
      preset_version: GenericTable;
      bracket: GenericTable;
      round: GenericTable;
      match: GenericTable;
      match_game: GenericTable;
      roulette_draw: GenericTable;
      draw_audit_log: GenericTable;
      comodin_inventory: GenericTable;
      comodin_usage: GenericTable;
      caster: GenericTable;
      dispute: GenericTable;
      spectator_wallet: GenericTable;
      bet: GenericTable;
    };
    Views: Record<string, any>;
    Functions: Record<string, any>;
    Enums: Record<string, any>;
  };
};
