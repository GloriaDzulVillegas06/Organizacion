(function(){
 const callbackUrl=new URL(location.href);
 const fragment=new URLSearchParams(callbackUrl.hash.slice(1));
 const callbackError=callbackUrl.searchParams.has('error')||callbackUrl.searchParams.has('error_code')||fragment.has('error')||fragment.has('error_code');
 document.addEventListener('DOMContentLoaded',async()=>{
  const form=document.querySelector('#invitation-form');
  const password=document.querySelector('#new-password');
  const confirmation=document.querySelector('#confirm-password');
  const button=document.querySelector('#accept-invitation');
  const status=document.querySelector('#invitation-status');
  const login=document.querySelector('#invitation-login');
  const client=window.Xolitas?.supabase;
  let valid=false;
  let busy=false;
  const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error)};
  const disable=disabled=>{password.disabled=disabled;confirmation.disabled=disabled;button.disabled=disabled};
  const cleanUrl=()=>history.replaceState(null,'',location.pathname);
  async function ownInvitation(){
   const {data,error}=await client.rpc('get_my_invitation');
   if(error)throw new Error('No se pudo verificar la invitacion. Solicita ayuda al administrador.');
   if(!data)throw new Error('El enlace no tiene una invitacion vigente. Solicita una nueva invitacion.');
   return data;
  }
  async function brand(organizationId){
   const {data:teams}=await client.from('teams').select('slug,name,logo_url,team_branding(*)').eq('organization_id',organizationId).eq('status','active').order('slug').limit(1);
   const team=teams?.[0];if(!team)return;
   login.href=`admin/login.html?team=${encodeURIComponent(team.slug)}`;
   document.querySelector('#invitation-team').textContent=team.name;
   document.title=`Activar cuenta | ${team.name}`;
   const logo=document.querySelector('#invitation-logo');
   if(team.logo_url){const url=new URL(team.logo_url,location.href);if(['https:','http:'].includes(url.protocol))logo.src=url.href}
   logo.alt=team.name;
   const branding=Array.isArray(team.team_branding)?team.team_branding[0]:team.team_branding;
   if(!branding)return;
   const colors={'--team-primary':branding.dashboard_primary_color||branding.primary_color,'--p9':branding.primary_color,'--p7':branding.secondary_color,'--team-button':branding.dashboard_button_color||branding.accent_color,'--ivory':branding.background_color,'--ink':branding.text_color};
   Object.entries(colors).forEach(([name,value])=>{if(value&&CSS.supports('color',value))document.documentElement.style.setProperty(name,value)});
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!valid||busy)return;
   if(password.value.length<8){message('La contrase\u00f1a debe tener al menos 8 caracteres.',true);return}
   if(password.value!==confirmation.value){message('Las contrase\u00f1as no coinciden.',true);return}
   busy=true;disable(true);button.textContent='Activando...';
   try{
    await ownInvitation();
    const {error:passwordError}=await client.auth.updateUser({password:password.value});
    if(passwordError)throw new Error(passwordError.message);
    const {data,error}=await client.rpc('accept_my_invitation');
    if(error)throw new Error(error.message);
    if(!data?.ok)throw new Error('No se pudo activar la membresia. Vuelve a intentarlo.');
    valid=false;form.reset();message('\u00a1Cuenta activada!');button.textContent='Cuenta activada';
    login.hidden=false;
    if(data.team_slug){
     login.href=`admin/login.html?team=${encodeURIComponent(data.team_slug)}`;
     setTimeout(()=>location.replace(`admin/dashboard.html?team=${encodeURIComponent(data.team_slug)}`),1800);
    }else{message('\u00a1Cuenta activada! Tu organizacion aun no tiene un equipo activo.')}
   }catch(error){message(error.message,true);button.textContent='Aceptar invitaci\u00f3n';disable(false)}
   finally{busy=false}
  });
  try{
   if(callbackError)throw new Error('El enlace vencio o ya fue utilizado. Solicita una nueva invitacion.');
   if(!client)throw new Error('Las invitaciones por correo requieren conexion con Supabase; no funcionan en modo demo.');
   const {data,error}=await client.auth.getSession();
   if(error||!data.session)throw new Error('El enlace no es valido o ha vencido. Abre el enlace completo del correo o solicita uno nuevo.');
   const {data:identity,error:identityError}=await client.auth.getUser();
   if(identityError||!identity.user)throw new Error('La sesion no es valida. Solicita una nueva invitacion.');
   cleanUrl();
   const invitation=await ownInvitation();
   document.querySelector('#invitation-email').textContent=identity.user.email;
   await brand(invitation.organization_id).catch(()=>{});
   valid=true;disable(false);message('');
  }catch(error){valid=false;disable(true);cleanUrl();message(error.message,true);login.hidden=false}
 });
})();