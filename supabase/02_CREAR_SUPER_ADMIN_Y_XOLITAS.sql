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
 if v_team is null then insert into public.teams(organization_id,name,short_name,slug,sport,logo_url,tagline,eyebrow,status) values(v_org,'Xolitas F.C.','Xolitas','xolitas','football','/Organizacion/assets/xolitas-crest.png','Una misma cancha. Una sola manada.','Orgullo · Fuerza · Comunidad','active') returning id into v_team; end if;
 insert into public.team_branding(team_id,primary_color,secondary_color,accent_color,background_color,text_color,dashboard_primary_color,dashboard_sidebar_color,dashboard_button_color) values(v_team,'#351137','#68245F','#DCB965','#FAF6F0','#291A29','#351137','#260928','#DCB965') on conflict(team_id) do update set primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,dashboard_primary_color=excluded.dashboard_primary_color,dashboard_sidebar_color=excluded.dashboard_sidebar_color,dashboard_button_color=excluded.dashboard_button_color;
 insert into public.team_site_settings(team_id,labels,modules,copy) values(v_team,'{"season":"Temporada 2026","calendar":"Calendario oficial","calendar_title_1":"HUELLAS EN","calendar_title_2":"LA CANCHA","roster_title_1":"NUESTRA","roster_title_2":"MANADA","stats_title_1":"LAS QUE","stats_title_2":"DEFINEN.","club_lead":"NO SOLO JUGAMOS.","club_title_1":"DEJAMOS","club_title_2":"HUELLA.","sponsors_title_1":"IMPULSAN NUESTRA","sponsors_title_2":"MANADA"}'::jsonb,'{"next_match":true,"last_result":true,"roster":true,"stats":true,"calendar":true,"live_match":true,"sponsors":true,"standings":true,"club":true}'::jsonb,'{"hero_tagline":"Una misma cancha.<br>Una sola manada.","roster_desc":"Talento, carácter y corazón.<br>Conoce a quienes defienden nuestros colores.","stats_desc":"Precisión, instinto y una ambición que no negocia.","footer":"Hechas de historia.<br>Jugamos el presente."}'::jsonb) on conflict(team_id) do update set labels=excluded.labels,modules=excluded.modules,copy=excluded.copy;
 select id into v_plan from public.plans where code='pro';
 if not exists(select 1 from public.subscriptions where organization_id=v_org) then insert into public.subscriptions(organization_id,plan_id,status) values(v_org,v_plan,'active'); end if;
end $$;
