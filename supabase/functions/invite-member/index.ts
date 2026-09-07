import { createClient } from 'npm:@supabase/supabase-js@2';

function keyFromEnvironment(name: string, provisionedName: string): string {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  const provisioned = Deno.env.get(provisionedName) || '';
  if (!provisioned) return '';
  try {
    const named = JSON.parse(provisioned);
    return typeof named === 'string' ? named : named.default || '';
  } catch {
    return '';
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  const respond = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers });
  try {
    const requestOrigin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Origin'] = requestOrigin || '*';
      return new Response(null, { status: 204, headers });
    }
    const configuredAppUrl = Deno.env.get('PUBLIC_APP_URL') || '';
    if (!configuredAppUrl) return respond(500, { error: 'Falta configurar PUBLIC_APP_URL en los secrets de invite-member.' });
    const appUrl = new URL(configuredAppUrl);
    if (appUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(appUrl.hostname)) {
      throw new Error('PUBLIC_APP_URL must use HTTPS');
    }
    if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash) {
      throw new Error('Invalid PUBLIC_APP_URL');
    }
    headers['Access-Control-Allow-Origin'] = appUrl.origin;
    if (requestOrigin && requestOrigin !== appUrl.origin) {
      return respond(403, { error: 'Origen no permitido.' });
    }
    if (request.method !== 'POST') return respond(405, { error: 'Metodo no permitido.' });
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      return respond(401, { error: 'Debes iniciar sesion.' });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const publishableKey = keyFromEnvironment('APP_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
    const secretKey = keyFromEnvironment('APP_SUPABASE_SECRET_KEY', 'SUPABASE_SECRET_KEYS');
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return respond(500, { error: 'Falta configurar las claves de Supabase en los secrets de invite-member.' });
    }
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const caller = createClient(supabaseUrl, publishableKey, {
      ...options, global: { headers: { Authorization: authorization } },
    });
    const { data: identity, error: identityError } = await caller.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (identityError || !identity.user) return respond(401, { error: 'La sesion no es valida. Inicia sesion nuevamente.' });
    let body;
    try { body = await request.json(); } catch { return respond(400, { error: 'Solicitud JSON invalida.' }); }
    const organizationId = body?.organization_id;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body?.role;
    if (typeof organizationId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(organizationId)) {
      return respond(400, { error: 'Organizacion invalida.' });
    }
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(400, { error: 'Correo invalido.' });
    }
    if (!['owner', 'admin', 'capturista', 'entrenador', 'viewer'].includes(role)) {
      return respond(400, { error: 'Rol invalido.' });
    }
    const { data: invitationId, error: invitationError } = await caller.rpc('invite_organization_member', {
      p_organization_id: organizationId, p_email: email, p_role: role,
    });
    if (invitationError) {
      const status = invitationError.code === '42501' ? 403 : invitationError.code === '22023' ? 400 : 500;
      return respond(status, { error: status === 500 ? 'No se pudo registrar la invitacion.' : invitationError.message });
    }
    const admin = createClient(supabaseUrl, secretKey, options);
    const complete = () => admin.rpc('complete_member_invitation', {
      p_invitation_id: invitationId, p_actor_id: identity.user.id,
    });
    let { data: resolution, error: resolutionError } = await complete();
    if (resolutionError) {
      return respond(resolutionError.code === '42501' ? 403 : 400, { error: 'No se pudo procesar esta invitacion. Comprueba tus permisos.' });
    }
    const existingResponse = () => respond(200, {
      status: 'active', message: 'El usuario ya ten\u00eda cuenta y fue agregado al equipo.',
    });
    if (resolution?.kind === 'existing') return existingResponse();
    const redirectTo = `${appUrl.toString().replace(/\/$/, '')}/aceptar-invitacion.html`;
    let mailError;
    if (resolution?.kind === 'new') {
      const result = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { organization_id: organizationId, organization_role: role, invitation_id: invitationId },
      });
      mailError = result.error;
      if (mailError && ['email_exists', 'user_already_exists'].includes(mailError.code || '')) {
        const retry = await complete();
        resolution = retry.data;
        resolutionError = retry.error;
        if (resolutionError) return respond(409, { error: 'La invitacion cambio. Vuelve a intentarlo.' });
        if (resolution?.kind === 'existing') return existingResponse();
      }
    }
    if (resolution?.kind === 'unconfirmed') {
      const authClient = createClient(supabaseUrl, publishableKey, options);
      const result = await authClient.auth.signInWithOtp({
        email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      mailError = result.error;
    } else if (resolution?.kind !== 'new') {
      return respond(500, { error: 'Respuesta de invitacion no valida.' });
    }
    if (mailError) {
      console.error('invite-member Auth mail failure', { code: mailError.code, status: mailError.status });
      return respond(mailError.status === 429 ? 429 : 502, {
        error: 'No se pudo enviar el correo. La invitacion sigue pendiente; espera un minuto y vuelve a intentarlo. Si persiste, revisa SMTP en Supabase.',
      });
    }
    return respond(200, { status: 'pending', message: 'Invitaci\u00f3n enviada por correo.' });
  } catch {
    console.error('invite-member: configuration or upstream failure');
    return respond(500, { error: 'No se pudo enviar la invitacion. Revisa la configuracion de la funcion.' });
  }
}

if (import.meta.main) Deno.serve(handleRequest);