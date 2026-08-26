-- 0007: Requisitos de inscripción revisados.
-- Reemplazan al checklist anterior (handbook/restream/terms/capitán) por:
--   anti_smurf_check  → lo verifica el staff (perfiles de AoE2)
--   payment_confirmed → pago de equipo confirmado por el staff
--   tutorial_watched  → autogestionado: el capitán marca que vio el tutorial
--   discord_joined    → autogestionado: el capitán marca que se unió al Discord
ALTER TABLE team_registration
  ADD COLUMN IF NOT EXISTS anti_smurf_check boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tutorial_watched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discord_joined boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
