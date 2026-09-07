-- Ejecutar sobre el esquema multi-tenant existente, no sobre una base vacia.
begin;

do $$
begin
  if to_regclass('public.invitations') is null
     or to_regclass('public.organization_members') is null
     or to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Falta el esquema base: invitations, organization_members o has_org_role(uuid,text[])';
  end if;
end $$;

alter table public.invitations add column if not exists requested_at timestamptz;
alter table public.invitations add column if not exists accepted_at timestamptz;
alter table public.invitations add column if not exists accepted_by uuid references auth.users(id);
alter table public.invitations enable row level security;
alter table public.organization_members enable row level security;

create or replace function public.can_manage_org_membership(p_org uuid,p_role text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_members member
    where member.organization_id=p_org and member.user_id=auth.uid() and member.status='active'
      and (member.role='owner' or (member.role='admin' and p_role<>'owner'))
  );
$$;
revoke all on function public.can_manage_org_membership(uuid,text) from public,anon;
grant execute on function public.can_manage_org_membership(uuid,text) to authenticated;

drop policy if exists "membership insert role boundary" on public.organization_members;
create policy "membership insert role boundary" on public.organization_members as restrictive
for insert to authenticated with check (public.can_manage_org_membership(organization_id,role));
drop policy if exists "membership update role boundary" on public.organization_members;
create policy "membership update role boundary" on public.organization_members as restrictive
for update to authenticated using (public.can_manage_org_membership(organization_id,role))
with check (public.can_manage_org_membership(organization_id,role));
drop policy if exists "membership delete role boundary" on public.organization_members;
create policy "membership delete role boundary" on public.organization_members as restrictive
for delete to authenticated using (public.can_manage_org_membership(organization_id,role));

revoke insert,update,delete,truncate,references,trigger on public.invitations from public,anon,authenticated;
drop policy if exists "invitations backend insert" on public.invitations;
create policy "invitations backend insert" on public.invitations as restrictive
for insert to anon,authenticated with check (false);
drop policy if exists "invitations backend update" on public.invitations;
create policy "invitations backend update" on public.invitations as restrictive
for update to anon,authenticated using (false) with check (false);
drop policy if exists "invitations backend delete" on public.invitations;
create policy "invitations backend delete" on public.invitations as restrictive
for delete to anon,authenticated using (false);

create or replace function public.invite_organization_member(p_organization_id uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  invitation_id uuid;
  actor_role text;
  normalized_email text:=lower(btrim(p_email));
  last_request timestamptz;
begin
  if auth.uid() is null or not public.has_org_role(p_organization_id,array['owner','admin']) then
    raise exception 'Sin permiso para invitar usuarios' using errcode='42501';
  end if;
  select role into actor_role from public.organization_members
  where organization_id=p_organization_id and user_id=auth.uid() and status='active';
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'Se requiere una membresia owner o admin en esta organizacion' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('owner','admin','capturista','entrenador','viewer') then
    raise exception 'Rol invalido' using errcode='22023';
  end if;
  if normalized_email is null or length(normalized_email)>254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Correo invalido' using errcode='22023';
  end if;
  if actor_role<>'owner' and (p_role='owner' or exists (
    select 1 from public.organization_members member join auth.users account on account.id=member.user_id
    where member.organization_id=p_organization_id and lower(account.email)=normalized_email and member.role='owner'
  )) then
    raise exception 'Solo owner puede asignar o modificar un owner' using errcode='42501';
  end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and status in ('active','trial')) then
    raise exception 'Organizacion no disponible' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||normalized_email,0));
  select requested_at into last_request from public.invitations
  where organization_id=p_organization_id and lower(email)=normalized_email
  order by requested_at desc nulls last limit 1;
  if last_request>now()-interval '60 seconds' then
    raise exception 'Espera un minuto antes de volver a invitar este correo' using errcode='22023';
  end if;
  insert into public.invitations(organization_id,email,role,status,invited_by,expires_at,requested_at)
  values(p_organization_id,normalized_email,p_role,'pending',auth.uid(),now()+interval '7 days',now())
  on conflict(organization_id,lower(email)) where status='pending'
  do update set role=excluded.role,invited_by=excluded.invited_by,expires_at=excluded.expires_at,requested_at=excluded.requested_at
  returning id into invitation_id;
  return invitation_id;
end $$;
revoke all on function public.invite_organization_member(uuid,text,text) from public,anon;
grant execute on function public.invite_organization_member(uuid,text,text) to authenticated;

create or replace function public.complete_member_invitation(p_invitation_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  invitation public.invitations%rowtype;
  account auth.users%rowtype;
  actor_role text;
begin
  select * into invitation from public.invitations where id=p_invitation_id for update;
  if invitation.id is null or invitation.invited_by is distinct from p_actor_id
     or invitation.status<>'pending' or invitation.expires_at<=now() then
    raise exception 'Invitacion no disponible' using errcode='22023';
  end if;
  if not exists(select 1 from public.organizations where id=invitation.organization_id and status in ('active','trial')) then
    raise exception 'Organizacion no disponible' using errcode='22023';
  end if;
  select role into actor_role from public.organization_members
  where organization_id=invitation.organization_id and user_id=p_actor_id and status='active' for share;
  if actor_role is null or actor_role not in ('owner','admin')
     or (invitation.role='owner' and actor_role<>'owner') then
    raise exception 'Sin permiso para invitar usuarios' using errcode='42501';
  end if;
  select * into account from auth.users where lower(email)=lower(invitation.email) limit 1;
  if account.id is null then
    return jsonb_build_object('kind','new');
  end if;
  if account.banned_until>now() or account.deleted_at is not null then
    raise exception 'No se pudo procesar esta invitacion' using errcode='22023';
  end if;
  if account.email_confirmed_at is null then
    return jsonb_build_object('kind','unconfirmed');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(invitation.organization_id::text||':'||account.id::text,0));
  if actor_role<>'owner' and exists(select 1 from public.organization_members
    where organization_id=invitation.organization_id and user_id=account.id and role='owner') then
    raise exception 'Solo owner puede modificar un owner' using errcode='42501';
  end if;
  insert into public.organization_members(organization_id,user_id,role,status)
  values(invitation.organization_id,account.id,invitation.role,'active')
  on conflict(organization_id,user_id) do update set role=excluded.role,status=excluded.status
  where (organization_members.role,organization_members.status) is distinct from (excluded.role,excluded.status);
  update public.invitations set status='accepted',accepted_at=now() where id=invitation.id;
  return jsonb_build_object('kind','existing');
end $$;
revoke all on function public.complete_member_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_member_invitation(uuid,uuid) to service_role;

create or replace function public.accept_my_invitation()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  my_email text:=lower(coalesce(auth.jwt()->>'email',''));
  invitation public.invitations%rowtype;
  accepted jsonb:='[]'::jsonb;
  actor_role text;
  destination text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion' using errcode='42501'; end if;
  if my_email='' or not exists(select 1 from auth.users where id=auth.uid()
    and lower(email)=my_email and email_confirmed_at is not null
    and deleted_at is null and (banned_until is null or banned_until<=now())) then
    raise exception 'La sesion no tiene un correo verificado vigente' using errcode='42501';
  end if;
  for invitation in select * from public.invitations
    where lower(email)=my_email and status='pending' and expires_at>now()
    order by organization_id,id for update
  loop
    select role into actor_role from public.organization_members
    where organization_id=invitation.organization_id and user_id=invitation.invited_by and status='active' for share;
    if actor_role is null or actor_role not in ('owner','admin')
       or (invitation.role='owner' and actor_role<>'owner')
       or not exists(select 1 from public.organizations where id=invitation.organization_id and status in ('active','trial')) then
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(invitation.organization_id::text||':'||auth.uid()::text,0));
    if actor_role<>'owner' and exists(select 1 from public.organization_members
      where organization_id=invitation.organization_id and user_id=auth.uid() and role='owner') then
      continue;
    end if;
    insert into public.organization_members(organization_id,user_id,role,status)
    values(invitation.organization_id,auth.uid(),invitation.role,'active')
    on conflict(organization_id,user_id) do update set role=excluded.role,status=excluded.status
    where (organization_members.role,organization_members.status) is distinct from (excluded.role,excluded.status);
    update public.invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
    accepted:=accepted||jsonb_build_array(jsonb_build_object('organization_id',invitation.organization_id,'role',invitation.role));
  end loop;
  if jsonb_array_length(accepted)=0 then
    select jsonb_build_array(jsonb_build_object('organization_id',member.organization_id,'role',member.role)) into accepted
    from public.invitations previous join public.organization_members member
      on member.organization_id=previous.organization_id and member.user_id=auth.uid() and member.status='active'
    where previous.accepted_by=auth.uid() and lower(previous.email)=my_email
      and exists(select 1 from public.organizations where id=member.organization_id and status in ('active','trial'))
      and previous.status='accepted' and previous.expires_at>now()
    order by previous.accepted_at desc limit 1;
    if accepted is null then
      raise exception 'No hay una invitacion pendiente vigente para este correo' using errcode='22023';
    end if;
  end if;
  select slug into destination from public.teams
  where organization_id=(accepted->0->>'organization_id')::uuid and status='active' order by slug limit 1;
  return jsonb_build_object('ok',true,'organization_id',accepted->0->>'organization_id',
    'role',accepted->0->>'role','memberships',accepted,'team_slug',destination);
end $$;
revoke all on function public.accept_my_invitation() from public,anon;
grant execute on function public.accept_my_invitation() to authenticated;

create or replace function public.list_organization_members(p_organization_id uuid)
returns table(id uuid,email text,role text,status text) language sql stable security definer set search_path=public as $$
  select member.id,account.email::text,member.role,member.status
  from public.organization_members member join auth.users account on account.id=member.user_id
  where member.organization_id=p_organization_id and public.has_org_role(p_organization_id,array['owner','admin'])
  union all
  select invitation.id,invitation.email,invitation.role,
    case when invitation.expires_at<=now() then 'expired' else 'invited' end
  from public.invitations invitation where invitation.organization_id=p_organization_id and invitation.status='pending'
    and public.has_org_role(p_organization_id,array['owner','admin']);
$$;
revoke all on function public.list_organization_members(uuid) from public,anon;
grant execute on function public.list_organization_members(uuid) to authenticated;

do $$
begin
  if to_regprocedure('public.activate_existing_invited_member(uuid,text,text)') is not null then
    execute 'revoke all on function public.activate_existing_invited_member(uuid,text,text) from public,anon,authenticated';
  end if;
end $$;

create or replace function public.get_my_invitation()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('organization_id',invitation.organization_id,'role',invitation.role)
  from public.invitations invitation
  join auth.users account on account.id=auth.uid() and lower(account.email)=lower(invitation.email)
  join public.organizations organization on organization.id=invitation.organization_id and organization.status in ('active','trial')
  where auth.uid() is not null and account.email_confirmed_at is not null
    and account.deleted_at is null and (account.banned_until is null or account.banned_until<=now())
    and lower(invitation.email)=lower(coalesce(auth.jwt()->>'email','')) and invitation.expires_at>now()
    and ((invitation.status='pending' and exists (
      select 1 from public.organization_members actor where actor.organization_id=invitation.organization_id
        and actor.user_id=invitation.invited_by and actor.status='active'
        and (actor.role='owner' or (actor.role='admin' and invitation.role<>'owner'
          and not exists(select 1 from public.organization_members target
            where target.organization_id=invitation.organization_id and target.user_id=auth.uid() and target.role='owner')))
    )) or (invitation.status='accepted' and invitation.accepted_by=auth.uid() and exists (
      select 1 from public.organization_members member where member.organization_id=invitation.organization_id
        and member.user_id=auth.uid() and member.status='active'
    )))
  order by invitation.created_at desc limit 1;
$$;
revoke all on function public.get_my_invitation() from public,anon;
grant execute on function public.get_my_invitation() to authenticated;

commit;