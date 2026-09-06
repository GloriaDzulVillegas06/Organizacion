-- 1) Primero crea tu usuario desde Authentication > Users en Supabase.
-- 2) Sustituye el correo de abajo por EL MISMO correo.
-- 3) Ejecuta este script una sola vez.

do $$
declare v_user uuid;v_org uuid;v_team uuid;v_plan uuid;
begin
 select id into v_user from auth.users where lower(email)=lower('TU_CORREO_AQUI') limit 1;
 if v_user is null then raise exception 'No existe ese correo en Supabase Auth'; end if;
 insert into public.platform_users(user_id,role) values(v_user,'super_admin') on conflict(user_id) do update set role='super_admin';
 select id into v_org from public.organizations where slug='xolitas';
 if v_org is null then insert into public.organizations(name,slug,status) values('Xolitas F.C.','xolitas','active') returning id into v_org; end if;
 insert into public.organization_members(organization_id,user_id,role,status) values(v_org,v_user,'owner','active') on conflict(organization_id,user_id) do update set role='owner',status='active';
 select id into v_team from public.teams where slug='xolitas';
 if v_team is null then insert into public.teams(organization_id,name,short_name,slug,sport,logo_url,tagline,eyebrow,status) values(v_org,'Xolitas F.C.','Xolitas','xolitas','football','/Organizacion/assets/img/xolitas-crest.png','Una misma cancha. Una sola manada.','Pasión · Equipo · Comunidad','active') returning id into v_team; end if;
 insert into public.team_branding(team_id,primary_color,secondary_color,accent_color,background_color,text_color,dashboard_primary_color,dashboard_sidebar_color,dashboard_button_color) values(v_team,'#351137','#68245F','#DCB965','#FAF6F0','#291A29','#351137','#260928','#DCB965') on conflict(team_id) do update set primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,dashboard_primary_color=excluded.dashboard_primary_color,dashboard_sidebar_color=excluded.dashboard_sidebar_color,dashboard_button_color=excluded.dashboard_button_color;
 insert into public.team_site_settings(team_id,labels,modules) values(v_team,'{"roster":"Nuestra manada","calendar":"Huellas en la cancha","stats":"XoliStats","club":"Dejamos huella","live":"XoliLive"}'::jsonb,'{"next_match":true,"last_result":true,"roster":true,"stats":true,"calendar":true,"live_match":true,"sponsors":true,"standings":true}'::jsonb) on conflict(team_id) do update set labels=excluded.labels,modules=excluded.modules;
 select id into v_plan from public.plans where code='pro';
 if not exists(select 1 from public.subscriptions where organization_id=v_org) then insert into public.subscriptions(organization_id,plan_id,status) values(v_org,v_plan,'active'); end if;
end $$;
