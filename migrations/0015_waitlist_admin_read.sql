-- ============================================================
-- 0015 — Lectura de la waitlist para el panel admin
--
-- cupo_waitlist (0013) nació write-only para el rol de usuario:
-- RLS sin policies. El staff necesita LEERLA desde /admin
-- (vista de lista de espera). INSERT sigue bloqueado para
-- anon/authenticated: las anotaciones entran solo vía server
-- action con service role (joinCupoWaitlist).
-- ============================================================

drop policy if exists "cupo_waitlist_admin_read" on cupo_waitlist;
create policy "cupo_waitlist_admin_read"
  on cupo_waitlist for select
  to authenticated
  using (
    exists (
      select 1
      from account a
      where a.supabase_auth_id = auth.uid()
        and a.role in ('admin', 'super_admin')
    )
  );
