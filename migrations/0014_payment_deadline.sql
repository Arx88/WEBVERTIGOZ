-- ============================================================
-- 0014 — Plazo de pago de la plaza (72hs) + motivo de estado
--
-- Regla de negocio: al aprobar una inscripción, el equipo tiene
-- 72hs (configurable por edición) para confirmar el pago de su
-- plaza. Vencido el plazo sin pago, la plaza se libera
-- automáticamente (cron /api/cron/payment-deadline) y se avisa a
-- la waitlist del wizard (cupo_waitlist, migración 0013).
-- Un admin también puede rechazar a mano (requisitos); en ese
-- caso el mismo circuito notifica si quedó lugar libre.
--
-- Todo es ADITIVO: una columna de config por edición, dos columnas
-- de auditoría/flujo en team_registration.
-- ============================================================

-- Ventana de pago por edición (horas desde la aprobación)
alter table tournament_edition add column if not exists payment_window_hours integer not null default 72;

-- Deadline concreto: se fija al aprobar (approved_at + ventana).
alter table team_registration add column if not exists payment_deadline_at timestamptz;

-- Motivo del rechazo: 'payment_timeout' (auto) | 'rejected_by_admin' | ...
alter table team_registration add column if not exists status_reason varchar(60);

-- Índice para el cron: aprobadas sin pago, con deadline
create index if not exists team_reg_unpaid_deadline_idx
  on team_registration (payment_deadline_at)
  where status = 'approved' and payment_confirmed = false;
