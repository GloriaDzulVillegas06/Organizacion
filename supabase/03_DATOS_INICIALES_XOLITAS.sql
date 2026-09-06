-- Ejecutar DESPUÉS de 02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql.
-- Carga la información base conocida del Google Sheet original de Xolitas.
do $$
declare t uuid;l uuid;p1 uuid;p2 uuid;p3 uuid;
begin
 select id into t from public.teams where slug='xolitas';
 if t is null then raise exception 'Primero ejecuta 02_CREAR_SUPER_ADMIN_Y_XOLITAS.sql'; end if;
 insert into public.players(team_id,first_name,last_name,jersey_number,position,active,legacy_id) values
 (t,'Jessica','',10,'Delantera',true,'JUG-001'),(t,'Andrea','',7,'Mediocampista',true,'JUG-002'),(t,'Fernanda','',1,'Portera',true,'JUG-003')
 on conflict do nothing;
 insert into public.leagues(team_id,name,season_name,duration_minutes,active,legacy_id) values(t,'Liga Xolitas','2026',40,true,'LIGA-001') on conflict do nothing;
 select id into l from public.leagues where team_id=t order by created_at limit 1;
 if not exists(select 1 from public.matches where team_id=t and legacy_id='PAR-001') then
  insert into public.matches(team_id,league_id,match_date,opponent_name,venue,competition_name,round_number,home_away,status,legacy_id) values(t,l,null,'Panteras','Cancha principal','Liga Xolitas',1,'home','scheduled','PAR-001');
 end if;
 if not exists(select 1 from public.matches where team_id=t and legacy_id='PAR-002') then
  insert into public.matches(team_id,league_id,match_date,opponent_name,venue,competition_name,round_number,home_away,status,legacy_id) values(t,l,null,'Amazonas','Cancha norte','Liga Xolitas',2,'away','scheduled','PAR-002');
 end if;
end $$;
