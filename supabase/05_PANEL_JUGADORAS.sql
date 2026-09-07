begin;

create table if not exists public.player_accounts (
  player_id uuid primary key references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  unique(team_id,user_id)
);
alter table public.player_accounts enable row level security;
revoke all on public.player_accounts from public,anon,authenticated;

alter table public.match_rosters add column if not exists availability text not null default 'pending'
  check(availability in ('pending','yes','no'));
alter table public.match_rosters add column if not exists attendance text not null default 'pending'
  check(attendance in ('pending','present','excused','absent'));
alter table public.match_rosters add column if not exists played boolean not null default false;
alter table public.match_rosters add column if not exists availability_at timestamptz;
alter table public.match_rosters add column if not exists recorded_by uuid references auth.users(id) on delete set null;
alter table public.match_rosters add column if not exists recorded_at timestamptz;

create or replace function public.can_coach_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.teams team
    join public.organizations organization on organization.id=team.organization_id
    where team.id=p_team_id and team.status='active' and organization.status in ('active','trial')
      and public.has_org_role(team.organization_id,array['owner','admin','entrenador']));
$$;
create or replace function public.is_my_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.player_accounts account
    join public.players player on player.id=account.player_id and player.team_id=account.team_id
    join public.teams team on team.id=player.team_id
    join public.organizations organization on organization.id=team.organization_id
    join public.organization_members member on member.organization_id=team.organization_id
      and member.user_id=account.user_id and member.status='active'
    where account.user_id=auth.uid() and player.id=p_player_id and player.active
      and team.status='active' and organization.status in ('active','trial'));
$$;
revoke all on function public.can_coach_team(uuid),public.is_my_player(uuid) from public,anon;
grant execute on function public.can_coach_team(uuid),public.is_my_player(uuid) to authenticated;

alter table public.match_rosters enable row level security;
revoke insert,update,delete on public.match_rosters from public,anon,authenticated;
drop policy if exists "roster private read" on public.match_rosters;
create policy "roster private read" on public.match_rosters as restrictive for select to authenticated
using ((public.can_coach_team(team_id) or public.is_my_player(player_id))
  and exists(select 1 from public.players player where player.id=match_rosters.player_id and player.team_id=match_rosters.team_id)
  and exists(select 1 from public.matches game where game.id=match_rosters.match_id and game.team_id=match_rosters.team_id));
drop policy if exists "roster anonymous read" on public.match_rosters;
create policy "roster anonymous read" on public.match_rosters as restrictive for select to anon using(false);
drop policy if exists "roster rpc writes" on public.match_rosters;
create policy "roster rpc writes" on public.match_rosters as restrictive for all to authenticated
using (public.can_coach_team(team_id) or public.is_my_player(player_id)) with check (false);

create or replace function public.set_player_account(p_player_id uuid,p_email text)
returns void language plpgsql security definer set search_path=public as $$
declare target public.players%rowtype; target_organization_id uuid; account_id uuid;
begin
  select * into target from public.players where id=p_player_id for update;
  select team.organization_id into target_organization_id from public.teams team where team.id=target.team_id;
  if target.id is null or not public.can_coach_team(target.team_id)
    or not public.has_org_role(target_organization_id,array['owner','admin']) then
    raise exception 'Solo administradores del equipo pueden vincular cuentas' using errcode='42501';
  end if;
  if p_email is null then
    delete from public.player_accounts where player_id=target.id;
    return;
  end if;
  select account.id into account_id from auth.users account
    join public.organization_members member on member.user_id=account.id
    where lower(account.email)=lower(btrim(p_email)) and member.organization_id=target_organization_id
      and member.status='active' and account.email_confirmed_at is not null;
  if account_id is null then raise exception 'El correo debe tener una cuenta confirmada y membresia activa en esta organizacion'; end if;
  if exists(select 1 from public.player_accounts where team_id=target.team_id and user_id=account_id and player_id<>target.id) then
    raise exception 'Esta cuenta ya tiene otra ficha vinculada en el equipo';
  end if;
  insert into public.player_accounts(player_id,team_id,user_id,linked_by)
  values(target.id,target.team_id,account_id,auth.uid())
  on conflict(player_id) do update set user_id=excluded.user_id,team_id=excluded.team_id,linked_by=auth.uid(),linked_at=now();
end $$;

create or replace function public.set_match_attendance(p_match_id uuid,p_player_id uuid,p_role text,p_attendance text,p_played boolean)
returns void language plpgsql security definer set search_path=public as $$
declare game public.matches%rowtype; athlete public.players%rowtype;
begin
  select * into game from public.matches where id=p_match_id for share;
  select * into athlete from public.players where id=p_player_id for share;
  if game.id is null or athlete.id is null or athlete.team_id<>game.team_id or not public.can_coach_team(game.team_id) then
    raise exception 'Sin permiso para registrar este partido o jugadora' using errcode='42501';
  end if;
  if game.status not in ('scheduled','live','break','finished') then raise exception 'No se registra asistencia en descansos o partidos cancelados'; end if;
  if p_role is null or p_role not in ('starter','substitute','available','out')
     or p_attendance is null or p_attendance not in ('pending','present','excused','absent') or p_played is null then
    raise exception 'Registro invalido';
  end if;
  if game.status='scheduled' and (p_attendance<>'pending' or p_played) then raise exception 'La asistencia se registra al iniciar o finalizar el partido'; end if;
  if game.status='scheduled' and not athlete.active and p_role<>'out' then raise exception 'La jugadora no esta activa'; end if;
  if p_role='out' and (p_attendance<>'pending' or p_played) then raise exception 'Una jugadora no convocada no tiene falta ni participacion'; end if;
  if p_played and p_attendance<>'present' then raise exception 'Para registrar participacion debe estar presente'; end if;
  insert into public.match_rosters(team_id,match_id,player_id,role,attendance,played,recorded_by,recorded_at)
  values(game.team_id,game.id,athlete.id,p_role,p_attendance,p_played,auth.uid(),now())
  on conflict(match_id,player_id) do update set role=excluded.role,attendance=excluded.attendance,played=excluded.played,
    availability=case when excluded.role='out' or match_rosters.role='out' then 'pending' else match_rosters.availability end,
    availability_at=case when excluded.role='out' or match_rosters.role='out' then null else match_rosters.availability_at end,
    recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at;
end $$;

create or replace function public.set_my_availability(p_match_id uuid,p_availability text)
returns void language plpgsql security definer set search_path=public as $$
declare game public.matches%rowtype;
begin
  select * into game from public.matches where id=p_match_id for share;
  if p_availability is null or p_availability not in ('pending','yes','no') then raise exception 'Disponibilidad invalida'; end if;
  if game.id is null or game.status<>'scheduled' then raise exception 'La convocatoria ya no admite respuestas'; end if;
  update public.match_rosters roster set availability=p_availability,availability_at=now()
    where roster.match_id=game.id and roster.team_id=game.team_id and roster.role<>'out' and public.is_my_player(roster.player_id);
  if not found then raise exception 'No tienes una convocatoria para este partido' using errcode='42501'; end if;
end $$;

create or replace function public.player_dashboard(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare athlete public.players%rowtype; games jsonb;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion' using errcode='42501'; end if;
  select * into athlete from public.players where team_id=p_team_id and public.is_my_player(id);
  if athlete.id is null then return jsonb_build_object('player',null,'matches','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',game.id,'league_id',game.league_id,'date',game.match_date,'time',game.match_time,'opponent',game.opponent_name,
    'venue',game.venue,'status',game.status,'goals_for',game.goals_for,'goals_against',game.goals_against,
    'role',roster.role,'availability',roster.availability,'attendance',roster.attendance,'played',coalesce(roster.played,false),
    'goals',(select count(*) from public.match_events event where event.match_id=game.id and event.player_id=athlete.id and event.team_id=game.team_id and not event.annulled and event.event_type='goal'),
    'yellows',(select count(*) from public.match_events event where event.match_id=game.id and event.player_id=athlete.id and event.team_id=game.team_id and not event.annulled and event.event_type='yellow'),
    'reds',(select count(*) from public.match_events event where event.match_id=game.id and event.player_id=athlete.id and event.team_id=game.team_id and not event.annulled and event.event_type in ('red','second_yellow','expulsion'))
  ) order by game.match_date,game.id),'[]'::jsonb) into games
  from public.matches game left join public.match_rosters roster on roster.match_id=game.id and roster.player_id=athlete.id and roster.team_id=game.team_id
  where game.team_id=p_team_id and game.status in ('scheduled','live','break','finished');
  return jsonb_build_object('player',jsonb_build_object('id',athlete.id,'name',concat_ws(' ',athlete.first_name,athlete.last_name),'number',athlete.jersey_number,'photo',athlete.photo_url),'matches',games);
end $$;

create or replace function public.coach_attendance(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare athletes jsonb; games jsonb; records jsonb;
begin
  if not public.can_coach_team(p_team_id) then raise exception 'Sin permiso para consultar asistencia' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',player.id,'name',concat_ws(' ',player.first_name,player.last_name),
    'number',player.jersey_number,'active',player.active,'email',case when public.has_org_role(public.team_org(p_team_id),array['owner','admin']) then account.email else null end)
    order by player.first_name,player.id),'[]'::jsonb) into athletes
  from public.players player left join public.player_accounts link on link.player_id=player.id and link.team_id=player.team_id
    left join auth.users account on account.id=link.user_id where player.team_id=p_team_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',game.id,'league_id',game.league_id,'date',game.match_date,'time',game.match_time,
    'opponent',game.opponent_name,'status',game.status) order by game.match_date desc,game.id),'[]'::jsonb) into games
    from public.matches game where game.team_id=p_team_id and game.status in ('scheduled','live','break','finished');
  select coalesce(jsonb_agg(to_jsonb(roster)),'[]'::jsonb) into records from public.match_rosters roster
    join public.players player on player.id=roster.player_id and player.team_id=roster.team_id
    join public.matches game on game.id=roster.match_id and game.team_id=roster.team_id
    where roster.team_id=p_team_id and game.status in ('scheduled','live','break','finished');
  return jsonb_build_object('players',athletes,'matches',games,'rosters',records);
end $$;

revoke all on function public.set_player_account(uuid,text),public.set_match_attendance(uuid,uuid,text,text,boolean),
  public.set_my_availability(uuid,text),public.player_dashboard(uuid),public.coach_attendance(uuid) from public,anon;
grant execute on function public.set_player_account(uuid,text),public.set_match_attendance(uuid,uuid,text,text,boolean),
  public.set_my_availability(uuid,text),public.player_dashboard(uuid),public.coach_attendance(uuid) to authenticated;

create or replace function public.player_match_count(p_player_id uuid)
returns integer language sql stable security definer set search_path=public as $$
  select count(*)::integer from public.match_rosters roster
    join public.matches game on game.id=roster.match_id and game.team_id=roster.team_id
    join public.players player on player.id=roster.player_id and player.team_id=roster.team_id
    join public.teams team on team.id=player.team_id
    where player.id=p_player_id and roster.played and roster.attendance='present' and roster.role<>'out' and game.status='finished'
      and ((team.public_site_enabled and team.status='active') or public.is_org_member(team.organization_id));
$$;
revoke all on function public.player_match_count(uuid) from public;
grant execute on function public.player_match_count(uuid) to anon,authenticated;

create or replace view public.v_player_stats with (security_invoker=true) as
select player.id,player.team_id,player.first_name,player.last_name,player.jersey_number,player.position,player.photo_url,
 public.player_match_count(player.id) as matches,
 count(case when event.event_type='goal' and event.annulled=false then 1 end)::int as goals,
 count(case when event.event_type='yellow' and event.annulled=false then 1 end)::int as yellows,
 count(case when event.event_type in ('red','second_yellow','expulsion') and event.annulled=false then 1 end)::int as reds,
 coalesce((select jsonb_object_agg(totals.league_id::text,totals.goals) from (
   select game.league_id,count(*)::int goals from public.match_events goal
   join public.matches game on game.id=goal.match_id
   where goal.player_id=player.id and goal.annulled=false and goal.event_type='goal' and game.league_id is not null
   group by game.league_id
 ) totals),'{}'::jsonb) as goals_by_league
from public.players player
left join public.matches game on game.team_id=player.team_id
left join public.match_events event on event.player_id=player.id and event.match_id=game.id
group by player.id;

commit;