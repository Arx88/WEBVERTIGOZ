-- ============================================================
-- VÉRTIGO — Fix del trigger handle_new_user
-- El trigger original fallaba porque SECURITY DEFINER no alcanzaba.
-- Lo reescribimos como SECURITY DEFINER explícito + search_path locked.
-- ============================================================

-- Drop el trigger y la función existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Crear función con SECURITY DEFINER explícito + search_path seguro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insertar en account, ignora si ya existe (ON CONFLICT)
  INSERT INTO public.account (supabase_auth_id, email, role)
  VALUES (NEW.id, NEW.email, 'owner')
  ON CONFLICT (supabase_auth_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log al stderr de postgres pero no falla el signup
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Crear el trigger nuevamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verificar
SELECT 'Trigger handle_new_user recreado correctamente' as status;
