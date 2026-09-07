-- Habilita actualizaciones del marcador publico en tiempo real.
-- Ejecutar despues del esquema base. Es idempotente y no modifica datos.
do $$
begin
  if to_regclass('public.matches') is null or to_regclass('public.match_events') is null then
    raise exception 'Faltan public.matches o public.match_events';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='match_events'
  ) then
    alter publication supabase_realtime add table public.match_events;
  end if;
end $$;

-- La pagina publica necesita leer cambios, pero RLS sigue controlando las filas.
grant select on public.matches,public.match_events to anon,authenticated;
