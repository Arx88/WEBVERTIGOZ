-- Lee policies RLS de una tabla (para debug desde exec_sql).
CREATE OR REPLACE FUNCTION public.get_policies_for(table_name text)
RETURNS TABLE(policyname name, cmd text, qual text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT policyname, cmd::text, qual::text
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = table_name
  ORDER BY cmd;
$$;

REVOKE EXECUTE ON FUNCTION public.get_policies_for(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_policies_for(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_policies_for(text) TO service_role;
