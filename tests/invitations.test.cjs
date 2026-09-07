const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');

test('SQL incremental: permisos, aceptacion propia y cuentas existentes',async context=>{
 const db=new PGlite();
 context.after(()=>db.close());
 await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; grant usage on schema auth,public to anon,authenticated,service_role;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table public.organizations(id uuid primary key,status text not null default 'active');
  create table public.platform_users(user_id uuid primary key references auth.users,role text);
  create table public.organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations,
   user_id uuid references auth.users,role text check(role in ('owner','admin','capturista','entrenador','viewer')),
   status text default 'active' check(status in ('active','invited','disabled')),unique(organization_id,user_id));
  create table public.teams(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations,slug text,status text default 'active');
  create table public.invitations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
   email text not null,role text not null check(role in ('owner','admin','capturista','entrenador','viewer')),
   status text not null default 'pending' check(status in ('pending','accepted','cancelled','expired')),
   invited_by uuid references auth.users,expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now());
  create unique index idx_invitation_pending_unique on public.invitations(organization_id,lower(email)) where status='pending';
  create function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
   select exists(select 1 from public.platform_users where user_id=auth.uid() and role='super_admin')$$;
  create function public.has_org_role(p_org uuid,p_roles text[]) returns boolean language sql stable security definer set search_path=public as $$
   select public.is_platform_admin() or exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and status='active' and role=any(p_roles))$$;
  grant select,insert,update,delete on public.organization_members,public.invitations to authenticated;
  alter table public.organization_members enable row level security;
  alter table public.invitations enable row level security;
  create policy "admins manage memberships" on public.organization_members for all
   using(public.has_org_role(organization_id,array['owner','admin'])) with check(public.has_org_role(organization_id,array['owner','admin']));
  create policy "org admins manage invitations" on public.invitations for all
   using(public.has_org_role(organization_id,array['owner','admin'])) with check(public.has_org_role(organization_id,array['owner','admin']));
  create function public.activate_existing_invited_member(uuid,text,text) returns uuid language sql as $$select null::uuid$$;
 `);
 const migration=fs.readFileSync('supabase/04_INVITACIONES_EMAIL.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.activate_existing_invited_member(uuid,text,text)','EXECUTE') as allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('anon','public.invite_organization_member(uuid,text,text)','EXECUTE') as allowed")).rows[0].allowed,false);
 const identifier=number=>`00000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
 const orgA=identifier(1),orgB=identifier(2),owner=identifier(10),admin=identifier(11),viewer=identifier(12),newUser=identifier(13),existing=identifier(14),other=identifier(15),globalAdmin=identifier(16);
 await db.query('insert into public.organizations(id) values ($1),($2)',[orgA,orgB]);
 for(const [user,email,confirmed] of [[owner,'owner@test.example',true],[admin,'admin@test.example',true],[viewer,'viewer@test.example',true],[newUser,'jessica@test.example',false],[existing,'existing@test.example',true],[other,'other@test.example',true],[globalAdmin,'global@test.example',true]]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[user,email,confirmed?new Date():null]);
 }
 await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin'),($1,$4,'viewer'),($5,$6,'owner')",[orgA,owner,admin,viewer,orgB,other]);
 await db.query("insert into public.platform_users values($1,'super_admin')",[globalAdmin]);
 await db.query("insert into public.teams(organization_id,slug) values($1,'xolitas'),($2,'otro')",[orgA,orgB]);
 async function asUser(user,email){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user||'',JSON.stringify({email})]);
  await db.exec('set role authenticated');
 }
 const memberId=async user=>(await db.query('select id from public.organization_members where organization_id=$1 and user_id=$2',[orgA,user])).rows[0].id;
 const invite=async(org,email,role='capturista')=>(await db.query('select public.invite_organization_member($1,$2,$3) as id',[org,email,role])).rows[0].id;
 const rpc=async(name)=>(await db.query(`select public.${name}() as result`)).rows[0].result;
 const complete=async(invitation,actor)=>{
  await db.exec('set role service_role');
  return (await db.query('select public.complete_member_invitation($1,$2) as result',[invitation,actor])).rows[0].result;
 };
 await asUser(admin,'admin@test.example');
 await db.query("select public.set_organization_member_role($1,$2,'entrenador')",[orgA,await memberId(viewer)]);
 await assert.rejects(db.query("select public.set_organization_member_role($1,$2,'owner')",[orgA,await memberId(viewer)]),/owner|permiso/i);
 await assert.rejects(db.query("select public.set_organization_member_role($1,$2,'viewer')",[orgA,await memberId(admin)]),/propio|permiso|owner/i);
 await assert.rejects(db.query("select public.set_organization_member_role($1,$2,'viewer')",[orgA,await memberId(owner)]),/owner|permiso/i);
 await asUser(globalAdmin,'global@test.example');
 await db.query("select public.set_organization_member_role($1,$2,'admin')",[orgA,await memberId(owner)]);
 await db.query("select public.set_organization_member_role($1,$2,'owner')",[orgA,await memberId(owner)]);
 await asUser(owner,'owner@test.example');
 await assert.rejects(invite(orgB,'blocked@test.example'),/permiso/i);
 await assert.rejects(invite(orgA,'bad-email'),/Correo invalido/);
 await assert.rejects(invite(orgA,'bad@test.example','SUPER_ADMIN'),/Rol invalido/);
 await assert.rejects(invite(orgA,'bad@test.example',null),/Rol invalido/);
 await asUser(viewer,'viewer@test.example');
 await assert.rejects(invite(orgA,'blocked@test.example'),/permiso/i);
 await asUser(globalAdmin,'global@test.example');
 await assert.rejects(invite(orgA,'blocked@test.example'),/membresia/i);
 await asUser(admin,'admin@test.example');
 await assert.rejects(invite(orgA,'owner-request@test.example','owner'),/Solo owner/);
 await assert.rejects(invite(orgA,'owner@test.example','viewer'),/Solo owner/);
 await assert.rejects(db.query("update public.organization_members set role='owner' where user_id=$1",[admin]),/row-level security/);
 await assert.rejects(db.query("insert into public.invitations(organization_id,email,role) values($1,'forged@test.example','owner')",[orgA]),/permission denied/);
 await assert.rejects(db.query('select public.complete_member_invitation($1,$2)',[identifier(90),admin]),/permission denied/);
 await asUser(owner,'owner@test.example');
 const invitation=await invite(orgA,'  JESSICA@test.example  ');
 await assert.rejects(invite(orgA,'jessica@test.example'),/Espera un minuto/);
 assert.equal((await complete(invitation,owner)).kind,'unconfirmed');
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int as total from public.organization_members where user_id=$1',[newUser])).rows[0].total,0);
 await asUser(newUser,'jessica@test.example');
 await assert.rejects(rpc('accept_my_invitation'),/verificado/);
 await db.exec('reset role');
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[newUser]);
 await asUser(other,'other@test.example');
 assert.equal(await rpc('get_my_invitation'),null);
 await assert.rejects(rpc('accept_my_invitation'),/No hay una invitacion/);
 await asUser(newUser,'jessica@test.example');
 assert.equal((await rpc('get_my_invitation')).organization_id,orgA);
 const accepted=await rpc('accept_my_invitation');
 assert.equal(accepted.role,'capturista');assert.equal(accepted.team_slug,'xolitas');
 assert.equal((await rpc('accept_my_invitation')).organization_id,orgA);
 await assert.rejects(invite(orgA,'escalate@test.example','owner'),/permiso/);
 await asUser(other,'other@test.example');
 const second=await invite(orgB,'jessica@test.example','entrenador');
 assert.equal((await complete(second,other)).kind,'existing');
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int as total from public.organization_members where user_id=$1',[newUser])).rows[0].total,2);
 assert.equal((await db.query('select count(*)::int as total from auth.users where id=$1',[newUser])).rows[0].total,1);
 await asUser(owner,'owner@test.example');
 const existingInvitation=await invite(orgA,'existing@test.example','viewer');
 assert.equal((await complete(existingInvitation,owner)).kind,'existing');
 await db.exec('reset role');
 await db.query("update public.invitations set requested_at=now()-interval '2 minutes' where id=$1",[existingInvitation]);
 await asUser(owner,'owner@test.example');
 const updated=await invite(orgA,'existing@test.example','entrenador');
 assert.equal((await complete(updated,owner)).kind,'existing');
 await db.exec('reset role');
 const members=(await db.query('select role,status from public.organization_members where organization_id=$1 and user_id=$2',[orgA,existing])).rows;
 assert.deepEqual(members,[{role:'entrenador',status:'active'}]);
 await asUser(owner,'owner@test.example');
 const expired=await invite(orgA,'other@test.example');
 await db.exec('reset role');
 await db.query("update public.invitations set expires_at=now()-interval '1 second' where id=$1",[expired]);
 await asUser(other,'other@test.example');
 assert.equal(await rpc('get_my_invitation'),null);
 await assert.rejects(rpc('accept_my_invitation'),/No hay una invitacion/);
 await asUser(owner,'owner@test.example');
 const suspended=await invite(orgA,'suspended@test.example');
 await db.exec('reset role');
 await db.query("update public.organizations set status='suspended' where id=$1",[orgA]);
 await assert.rejects(complete(suspended,owner),/Organizacion no disponible/);
 await asUser(newUser,'jessica@test.example');
 await assert.rejects(rpc('accept_my_invitation'),/No hay una invitacion/);
 await db.exec('reset role');
 await db.query("update public.organizations set status='active' where id=$1",[orgA]);
 await asUser(null,'');
 await assert.rejects(rpc('accept_my_invitation'),/Debes iniciar sesion/);
 await db.exec('set role anon');
 await assert.rejects(rpc('accept_my_invitation'),/permission denied/);
 await db.exec('reset role');
 const platformUsers=(await db.query('select user_id from public.platform_users')).rows;
 assert.deepEqual(platformUsers,[{user_id:globalAdmin}]);
});