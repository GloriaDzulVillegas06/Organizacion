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

create or replace function public.reset_match_for_capture(p_match_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_team_id uuid;
begin
  select match.team_id into v_team_id from public.matches match where match.id=p_match_id for update;
  if v_team_id is null or not public.has_org_role(public.team_org(v_team_id),array['owner','admin','capturista']) then
    raise exception 'Sin permiso para reiniciar este partido' using errcode='42501';
  end if;
  update public.match_events set annulled=true,annulled_at=now(),annulled_by=auth.uid()
    where match_id=p_match_id and team_id=v_team_id and annulled=false;
  update public.matches set status='scheduled',goals_for=0,goals_against=0,started_at=null,ended_at=null,updated_at=now()
    where id=p_match_id;
end $$;
revoke all on function public.reset_match_for_capture(uuid) from public,anon;
grant execute on function public.reset_match_for_capture(uuid) to authenticated;
