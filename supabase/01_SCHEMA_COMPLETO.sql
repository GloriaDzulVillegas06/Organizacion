-- ============================================================
-- SPORTS ADMIN · ESQUEMA MULTI-TENANT PARA SUPABASE
-- Ejecutar completo en SQL Editor de Supabase.
-- Diseñado para GitHub Pages + supabase-js v2.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Organizaciones / usuarios ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  status text not null default 'trial' check (status in ('trial','active','suspended','cancelled')),
  locale text not null default 'es-MX',
  timezone text not null default 'America/Merida',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin','support')),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','capturista','entrenador','viewer')),
  status text not null default 'active' check (status in ('invited','active','disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id,user_id)
);

-- ---------- Planes ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_mxn numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.features (
  code text primary key,
  name text not null,
  description text
);

create table if not exists public.plan_features (
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_code text not null references public.features(code) on delete cascade,
  enabled boolean not null default false,
  limit_value integer,
  primary key (plan_id,feature_code)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  trial_ends_at timestamptz,
  provider text,
  provider_subscription_id text,
  created_at timestamptz not null default now()
);

-- ---------- Equipos ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  short_name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sport text not null default 'football',
  logo_url text,
  tagline text,
  eyebrow text,
  public_site_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_branding (
  team_id uuid primary key references public.teams(id) on delete cascade,
  primary_color text not null default '#351137' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#68245F' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#DCB965' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#FAF6F0' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null default '#291A29' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  dashboard_primary_color text not null default '#351137' check (dashboard_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  dashboard_sidebar_color text not null default '#260928' check (dashboard_sidebar_color ~ '^#[0-9A-Fa-f]{6}$'),
  dashboard_button_color text not null default '#DCB965' check (dashboard_button_color ~ '^#[0-9A-Fa-f]{6}$'),
  favicon_url text,
  cover_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_site_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  labels jsonb not null default '{"roster":"Plantilla","calendar":"Calendario oficial","stats":"Goleadoras","club":"Nuestra identidad"}'::jsonb,
  modules jsonb not null default '{"next_match":true,"last_result":true,"roster":true,"stats":true,"calendar":true,"live_match":true,"sponsors":true}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Datos deportivos ----------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text,
  nickname text,
  jersey_number integer check (jersey_number between 0 and 999),
  position text,
  photo_url text,
  notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  season_name text,
  duration_minutes integer not null default 40,
  active boolean not null default true,
  legacy_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete set null,
  match_date date,
  match_time time,
  opponent_name text,
  opponent_logo_url text,
  venue text,
  competition_name text,
  round_number integer,
  home_away text default 'home' check (home_away in ('home','away','neutral')),
  status text not null default 'scheduled' check (status in ('scheduled','live','break','finished','cancelled','rest')),
  duration_minutes integer not null default 40,
  goals_for integer not null default 0 check (goals_for >= 0),
  goals_against integer not null default 0 check (goals_against >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  related_player_id uuid references public.players(id) on delete set null,
  event_type text not null check (event_type in ('goal','rival_goal','own_goal','yellow','second_yellow','red','expulsion','substitution')),
  minute integer check (minute between 0 and 200),
  second integer check (second between 0 and 59),
  details jsonb not null default '{}'::jsonb,
  annulled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  annulled_by uuid references auth.users(id) on delete set null,
  annulled_at timestamptz,
  legacy_id text
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  logo_url text,
  website_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  team_name text not null,
  logo_url text,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  extra_points integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigserial primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Índices ----------
create index if not exists idx_org_members_user_org on public.organization_members(user_id,organization_id);
create index if not exists idx_teams_org_slug on public.teams(organization_id,slug);
create index if not exists idx_players_team_active on public.players(team_id,active);
create index if not exists idx_matches_team_date on public.matches(team_id,match_date desc);
create index if not exists idx_events_match_active on public.match_events(match_id,annulled,created_at);
create index if not exists idx_events_player_type on public.match_events(player_id,event_type);
create index if not exists idx_sponsors_team_active on public.sponsors(team_id,active,sort_order);

-- ---------- Helpers de seguridad ----------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_users p where p.user_id=auth.uid() and p.role='super_admin');
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(
    select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active'
  );
$$;

create or replace function public.has_org_role(p_org uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(
    select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)
  );
$$;

create or replace function public.team_org(p_team uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select organization_id from public.teams where id=p_team;
$$;

-- ---------- RLS ----------
alter table public.organizations enable row level security;
alter table public.platform_users enable row level security;
alter table public.organization_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_branding enable row level security;
alter table public.team_site_settings enable row level security;
alter table public.players enable row level security;
alter table public.leagues enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.sponsors enable row level security;
alter table public.standings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_log enable row level security;

-- políticas públicas / miembros
create policy "public active organizations" on public.organizations for select using (status in ('trial','active') or public.is_org_member(id));
create policy "members read own memberships" on public.organization_members for select using (user_id=auth.uid() or public.is_org_member(organization_id));
create policy "admins manage memberships" on public.organization_members for all using (public.has_org_role(organization_id,array['owner','admin'])) with check (public.has_org_role(organization_id,array['owner','admin']));
create policy "platform users self read" on public.platform_users for select using (user_id=auth.uid() or public.is_platform_admin());

create policy "public teams" on public.teams for select using (public_site_enabled=true and status='active' or public.is_org_member(organization_id));
create policy "org admins manage teams" on public.teams for all using (public.has_org_role(organization_id,array['owner','admin'])) with check (public.has_org_role(organization_id,array['owner','admin']));

create policy "public branding" on public.team_branding for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "admins manage branding" on public.team_branding for all using (public.has_org_role(public.team_org(team_id),array['owner','admin'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin']));
create policy "public site settings" on public.team_site_settings for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "admins manage site settings" on public.team_site_settings for all using (public.has_org_role(public.team_org(team_id),array['owner','admin'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin']));

create policy "public players" on public.players for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "staff manage players" on public.players for all using (public.has_org_role(public.team_org(team_id),array['owner','admin','entrenador'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin','entrenador']));

create policy "public leagues" on public.leagues for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "staff manage leagues" on public.leagues for all using (public.has_org_role(public.team_org(team_id),array['owner','admin'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin']));

create policy "public matches" on public.matches for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "staff manage matches" on public.matches for all using (public.has_org_role(public.team_org(team_id),array['owner','admin','capturista','entrenador'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin','capturista','entrenador']));

create policy "public match events" on public.match_events for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "capture match events" on public.match_events for insert with check (public.has_org_role(public.team_org(team_id),array['owner','admin','capturista']));
create policy "capture update events" on public.match_events for update using (public.has_org_role(public.team_org(team_id),array['owner','admin','capturista'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin','capturista']));

create policy "public sponsors" on public.sponsors for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "admins manage sponsors" on public.sponsors for all using (public.has_org_role(public.team_org(team_id),array['owner','admin'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin']));

create policy "public standings" on public.standings for select using (exists(select 1 from public.teams t where t.id=team_id and t.public_site_enabled=true and t.status='active') or public.is_org_member(public.team_org(team_id)));
create policy "admins manage standings" on public.standings for all using (public.has_org_role(public.team_org(team_id),array['owner','admin'])) with check (public.has_org_role(public.team_org(team_id),array['owner','admin']));

create policy "members read subscriptions" on public.subscriptions for select using (public.is_org_member(organization_id));
create policy "platform manages subscriptions" on public.subscriptions for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "members read audit" on public.audit_log for select using (public.has_org_role(organization_id,array['owner','admin']) or public.is_platform_admin());

-- ---------- RPC plataforma: crear / editar equipo ----------
create or replace function public.platform_upsert_team(
  p_team_id uuid,
  p_name text,
  p_short_name text,
  p_slug text,
  p_logo_url text,
  p_tagline text,
  p_eyebrow text,
  p_primary text,
  p_secondary text,
  p_accent text,
  p_background text,
  p_text text,
  p_dashboard_primary text,
  p_dashboard_sidebar text,
  p_dashboard_button text,
  p_labels jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_team uuid; v_org uuid;
begin
  if not public.is_platform_admin() then raise exception 'Solo SUPER_ADMIN puede usar esta función'; end if;
  if p_team_id is null then
    insert into public.organizations(name,slug,status,trial_ends_at)
    values(p_name,p_slug,'trial',now()+interval '14 days') returning id into v_org;
    insert into public.teams(organization_id,name,short_name,slug,logo_url,tagline,eyebrow)
    values(v_org,p_name,p_short_name,p_slug,p_logo_url,p_tagline,p_eyebrow) returning id into v_team;
    insert into public.organization_members(organization_id,user_id,role,status)
    values(v_org,auth.uid(),'owner','active') on conflict do nothing;
  else
    select organization_id into v_org from public.teams where id=p_team_id;
    if v_org is null then raise exception 'Equipo no encontrado'; end if;
    update public.teams set name=p_name,short_name=p_short_name,slug=p_slug,logo_url=p_logo_url,tagline=p_tagline,eyebrow=p_eyebrow,updated_at=now() where id=p_team_id;
    v_team:=p_team_id;
  end if;
  insert into public.team_branding(team_id,primary_color,secondary_color,accent_color,background_color,text_color,dashboard_primary_color,dashboard_sidebar_color,dashboard_button_color)
  values(v_team,p_primary,p_secondary,p_accent,p_background,p_text,p_dashboard_primary,p_dashboard_sidebar,p_dashboard_button)
  on conflict(team_id) do update set primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,text_color=excluded.text_color,dashboard_primary_color=excluded.dashboard_primary_color,dashboard_sidebar_color=excluded.dashboard_sidebar_color,dashboard_button_color=excluded.dashboard_button_color,updated_at=now();
  insert into public.team_site_settings(team_id,labels) values(v_team,coalesce(p_labels,'{}'::jsonb))
  on conflict(team_id) do update set labels=excluded.labels,updated_at=now();
  insert into public.audit_log(organization_id,team_id,user_id,action,entity_type,entity_id)
  values(v_org,v_team,auth.uid(),case when p_team_id is null then 'team_created' else 'team_updated' end,'team',v_team::text);
  return v_team;
end $$;

-- ---------- Eventos atómicos ----------
create or replace function public.undo_last_match_event(p_match_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_event uuid; v_team uuid;
begin
  select team_id into v_team from public.matches where id=p_match_id;
  if not public.has_org_role(public.team_org(v_team),array['owner','admin','capturista']) then raise exception 'Sin permiso'; end if;
  select id into v_event from public.match_events where match_id=p_match_id and annulled=false order by created_at desc limit 1 for update;
  if v_event is null then return null; end if;
  update public.match_events set annulled=true,annulled_by=auth.uid(),annulled_at=now() where id=v_event;
  return v_event;
end $$;

create or replace function public.start_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_team uuid; begin
  select team_id into v_team from public.matches where id=p_match_id;
  if not public.has_org_role(public.team_org(v_team),array['owner','admin','capturista']) then raise exception 'Sin permiso'; end if;
  update public.matches set status='live',started_at=coalesce(started_at,now()),updated_at=now() where id=p_match_id;
end $$;

create or replace function public.finish_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_team uuid; begin
  select team_id into v_team from public.matches where id=p_match_id;
  if not public.has_org_role(public.team_org(v_team),array['owner','admin','capturista']) then raise exception 'Sin permiso'; end if;
  update public.matches set status='finished',ended_at=now(),updated_at=now() where id=p_match_id;
end $$;

-- Recalcular marcador cuando se inserta/anula un evento.
create or replace function public.recalculate_match_score()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_match uuid; begin
  v_match:=coalesce(new.match_id,old.match_id);
  update public.matches m set
    goals_for=(select count(*) from public.match_events e where e.match_id=v_match and e.annulled=false and e.event_type in ('goal','own_goal')),
    goals_against=(select count(*) from public.match_events e where e.match_id=v_match and e.annulled=false and e.event_type='rival_goal'),
    updated_at=now()
  where m.id=v_match;
  return coalesce(new,old);
end $$;

drop trigger if exists trg_recalculate_match_score on public.match_events;
create trigger trg_recalculate_match_score after insert or update or delete on public.match_events for each row execute function public.recalculate_match_score();

-- ---------- Vista estadísticas ----------
create or replace view public.v_player_stats as
select p.id,p.team_id,p.first_name,p.last_name,p.jersey_number,p.position,p.photo_url,
 count(distinct case when m.status='finished' then m.id end)::int as matches,
 count(case when e.event_type='goal' and e.annulled=false then 1 end)::int as goals,
 count(case when e.event_type='yellow' and e.annulled=false then 1 end)::int as yellows,
 count(case when e.event_type in ('red','second_yellow','expulsion') and e.annulled=false then 1 end)::int as reds
from public.players p
left join public.matches m on m.team_id=p.team_id
left join public.match_events e on e.player_id=p.id and e.match_id=m.id
group by p.id;

-- ---------- Grants ----------
grant usage on schema public to anon,authenticated;
grant select on public.organizations,public.teams,public.team_branding,public.team_site_settings,public.players,public.leagues,public.matches,public.match_events,public.sponsors,public.standings,public.v_player_stats to anon,authenticated;
grant insert,update,delete on public.organization_members,public.teams,public.team_branding,public.team_site_settings,public.players,public.leagues,public.matches,public.match_events,public.sponsors,public.standings to authenticated;
grant select on public.organization_members,public.platform_users,public.subscriptions,public.audit_log to authenticated;
grant execute on function public.platform_upsert_team(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.undo_last_match_event(uuid), public.start_match(uuid), public.finish_match(uuid) to authenticated;

-- ---------- Storage ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('team-media','team-media',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "team media public read" on storage.objects for select using (bucket_id='team-media');
create policy "team media member insert" on storage.objects for insert to authenticated with check (
  bucket_id='team-media' and public.is_org_member((split_part(name,'/',1))::uuid)
);
create policy "team media member update" on storage.objects for update to authenticated using (
  bucket_id='team-media' and public.is_org_member((split_part(name,'/',1))::uuid)
);
create policy "team media member delete" on storage.objects for delete to authenticated using (
  bucket_id='team-media' and public.is_org_member((split_part(name,'/',1))::uuid)
);

-- ---------- Realtime ----------
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_events') then
    alter publication supabase_realtime add table public.match_events;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

-- ---------- Planes iniciales ----------
insert into public.plans(code,name,monthly_price_mxn) values
('starter','Starter',249),('pro','Pro',449),('elite','Elite',699),('club','Club',1299)
on conflict(code) do update set name=excluded.name,monthly_price_mxn=excluded.monthly_price_mxn;

insert into public.features(code,name,description) values
('live_match','Partido en vivo','Captura de eventos en tiempo real'),
('custom_branding','Identidad personalizada','Logo, colores y textos'),
('advanced_stats','Estadísticas avanzadas','Métricas e histórico'),
('sponsors','Patrocinadores','Sección de patrocinadores'),
('teams_limit','Límite de equipos','Cantidad de equipos por organización')
on conflict(code) do nothing;

-- FIN DEL ESQUEMA

-- ============================================================
-- EXTENSIONES DE LA VERSIÓN COMPLETA
-- ============================================================

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','capturista','entrenador','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now()+interval '7 days'),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_invitation_pending_unique on public.invitations(organization_id,lower(email)) where status='pending';
alter table public.invitations enable row level security;
create policy "org admins read invitations" on public.invitations for select using (public.has_org_role(organization_id,array['owner','admin']));
create policy "org admins manage invitations" on public.invitations for all using (public.has_org_role(organization_id,array['owner','admin'])) with check (public.has_org_role(organization_id,array['owner','admin']));

drop policy if exists "public plans" on public.plans;
drop policy if exists "public features" on public.features;
drop policy if exists "public plan features" on public.plan_features;
alter table public.plans enable row level security;
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
create policy "public plans" on public.plans for select using (active=true or public.is_platform_admin());
create policy "public features" on public.features for select using (true);
create policy "public plan features" on public.plan_features for select using (true);
create policy "platform manages plans" on public.plans for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "platform manages features" on public.features for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "platform manages plan features" on public.plan_features for all using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select on public.plans,public.features,public.plan_features to anon,authenticated;
grant select,insert,update,delete on public.invitations to authenticated;

create or replace function public.create_organization_with_team(
  p_org_name text,p_org_slug text,p_team_name text,p_team_short_name text,p_team_slug text,p_logo_url text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org uuid;v_team uuid;v_plan uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if not public.is_platform_admin() then raise exception 'Solo SUPER_ADMIN puede crear organizaciones'; end if;
  insert into public.organizations(name,slug,status,trial_ends_at) values(p_org_name,p_org_slug,'trial',now()+interval '14 days') returning id into v_org;
  insert into public.teams(organization_id,name,short_name,slug,logo_url) values(v_org,p_team_name,p_team_short_name,p_team_slug,p_logo_url) returning id into v_team;
  insert into public.organization_members(organization_id,user_id,role,status) values(v_org,auth.uid(),'owner','active');
  insert into public.team_branding(team_id) values(v_team);
  insert into public.team_site_settings(team_id) values(v_team);
  select id into v_plan from public.plans where code='pro' limit 1;
  if v_plan is not null then insert into public.subscriptions(organization_id,plan_id,status,trial_ends_at) values(v_org,v_plan,'trialing',now()+interval '14 days'); end if;
  return jsonb_build_object('organization_id',v_org,'team_id',v_team);
end $$;

create or replace function public.recalculate_match_score(p_match_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.matches m set
    goals_for=(select count(*) from public.match_events e where e.match_id=p_match_id and e.annulled=false and e.event_type in ('goal','own_goal')),
    goals_against=(select count(*) from public.match_events e where e.match_id=p_match_id and e.annulled=false and e.event_type='rival_goal'),updated_at=now()
  where m.id=p_match_id;
end $$;

create or replace function public.invite_organization_member(p_organization_id uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_user uuid;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin']) then raise exception 'Sin permiso para invitar usuarios'; end if;
  if p_role not in ('owner','admin','capturista','entrenador','viewer') then raise exception 'Rol inválido'; end if;
  select id into v_user from auth.users where lower(email)=lower(p_email) limit 1;
  if v_user is not null then
    insert into public.organization_members(organization_id,user_id,role,status) values(p_organization_id,v_user,p_role,'active')
    on conflict(organization_id,user_id) do update set role=excluded.role,status='active';
    return v_user;
  end if;
  insert into public.invitations(organization_id,email,role,invited_by) values(p_organization_id,lower(p_email),p_role,auth.uid())
  on conflict(organization_id,lower(email)) where status='pending' do update set role=excluded.role,expires_at=now()+interval '7 days'
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.list_organization_members(p_organization_id uuid)
returns table(id uuid,email text,role text,status text) language sql stable security definer set search_path=public as $$
  select m.id,u.email::text,m.role,m.status from public.organization_members m join auth.users u on u.id=m.user_id
  where m.organization_id=p_organization_id and public.is_org_member(p_organization_id)
  union all
  select i.id,i.email,i.role,'invited'::text from public.invitations i where i.organization_id=p_organization_id and i.status='pending' and public.is_org_member(p_organization_id);
$$;

create or replace view public.organization_subscription_features with (security_invoker=true) as
select s.organization_id,s.status,p.code as plan_code,p.name as plan_name,p.monthly_price_mxn,
       coalesce(jsonb_object_agg(pf.feature_code,jsonb_build_object('enabled',pf.enabled,'limit',pf.limit_value)) filter(where pf.feature_code is not null),'{}'::jsonb) as features
from public.subscriptions s left join public.plans p on p.id=s.plan_id left join public.plan_features pf on pf.plan_id=p.id
group by s.organization_id,s.status,p.code,p.name,p.monthly_price_mxn;

grant select on public.organization_subscription_features to authenticated;
grant execute on function public.create_organization_with_team(text,text,text,text,text,text),public.recalculate_match_score(uuid),public.invite_organization_member(uuid,text,text),public.list_organization_members(uuid) to authenticated;

-- Bucket usado por el frontend. Rutas: teams/{team_id}/{folder}/{archivo}
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('team-assets','team-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "team assets public read" on storage.objects for select using (bucket_id='team-assets');
create policy "team assets insert" on storage.objects for insert to authenticated with check (bucket_id='team-assets' and split_part(name,'/',1)='teams' and public.is_org_member(public.team_org((split_part(name,'/',2))::uuid)));
create policy "team assets update" on storage.objects for update to authenticated using (bucket_id='team-assets' and split_part(name,'/',1)='teams' and public.is_org_member(public.team_org((split_part(name,'/',2))::uuid)));
create policy "team assets delete" on storage.objects for delete to authenticated using (bucket_id='team-assets' and split_part(name,'/',1)='teams' and public.is_org_member(public.team_org((split_part(name,'/',2))::uuid)));

insert into public.plan_features(plan_id,feature_code,enabled,limit_value)
select p.id,f.code,true,case when f.code='teams_limit' then case p.code when 'starter' then 1 when 'pro' then 1 when 'elite' then 2 else 10 end else null end
from public.plans p cross join public.features f
where (p.code='starter' and f.code in ('custom_branding','sponsors','teams_limit'))
   or (p.code='pro' and f.code in ('custom_branding','sponsors','live_match','advanced_stats','teams_limit'))
   or (p.code in ('elite','club'))
on conflict(plan_id,feature_code) do update set enabled=excluded.enabled,limit_value=excluded.limit_value;
