-- Crear función exec_sql que permite ejecutar SQL arbitrario
-- vía RPC desde PostgREST (que sí funciona via HTTPS)
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE query;
  result := json_build_object('ok', true, 'executed_at', now());
  RETURN result;
END;
$$;

-- Permisos: solo service_role puede ejecutarla
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

SELECT 'exec_sql function creada' as status;
