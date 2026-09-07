import { handleRequest } from './index.ts';

const organizationId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const invitationId = '00000000-0000-4000-8000-000000000003';
const origin = 'https://app.example';
function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

type Scenario = {
  kind?: string;
  rpcDenied?: boolean;
  identityDenied?: boolean;
  mailFailure?: boolean;
  race?: boolean;
};

async function exercise(scenario: Scenario, check: (send: (body?: unknown, options?: RequestInit) => Promise<Response>, calls: {path: string; body: Record<string, unknown>; authorization: string | null}[]) => Promise<void>) {
  const previousFetch = globalThis.fetch;
  const variables: Record<string, string> = {
    PUBLIC_APP_URL: `${origin}/Organizacion`,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_placeholder',
    SUPABASE_SECRET_KEY: 'sb_secret_test_placeholder',
  };
  const previous = new Map(Object.keys(variables).map(name => [name, Deno.env.get(name)]));
  Object.entries(variables).forEach(([name, value]) => Deno.env.set(name, value));
  const calls: {path: string; body: Record<string, unknown>; authorization: string | null}[] = [];
  let resolutions = 0;
  globalThis.fetch = async (input, options) => {
    const request = new Request(input, options);
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() : {};
    calls.push({ path: url.pathname + url.search, body, authorization: request.headers.get('Authorization') });
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}});
    if (url.pathname === '/auth/v1/user') {
      return scenario.identityDenied ? reply({message:'Invalid JWT'},401) : reply({id:actorId,email:'owner@example.com'});
    }
    if (url.pathname.endsWith('/rpc/invite_organization_member')) {
      assert(request.headers.get('Authorization') === 'Bearer user-session-jwt');
      return scenario.rpcDenied ? reply({code:'42501',message:'Sin permiso para invitar usuarios'},403) : reply(invitationId);
    }
    if (url.pathname.endsWith('/rpc/complete_member_invitation')) {
      assert(body.p_actor_id === actorId && body.p_invitation_id === invitationId);
      resolutions++;
      return reply({kind:scenario.race && resolutions > 1 ? 'existing' : scenario.kind || 'new'});
    }
    if (url.pathname === '/auth/v1/invite' || url.pathname === '/auth/v1/otp') {
      assert(body.email === 'jessica@example.com');
      assert(url.searchParams.get('redirect_to') === `${origin}/Organizacion/aceptar-invitacion.html`);
      if (scenario.race) return reply({code:'email_exists',msg:'Exists'},422);
      if (scenario.mailFailure) return reply({code:'over_email_send_rate_limit',msg:'Limited'},429);
      return reply({id:'new-user',email:'jessica@example.com'});
    }
    throw new Error(`Unexpected request: ${request.url}`);
  };
  const send = (body: unknown = {organization_id:organizationId,email:' Jessica@Example.com ',role:'capturista'}, options: RequestInit = {}) =>
    handleRequest(new Request(`${origin}/functions/v1/invite-member`, {
      method:'POST',headers:{Authorization:'Bearer user-session-jwt',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),...options,
    }));
  try { await check(send,calls); }
  finally {
    globalThis.fetch = previousFetch;
    previous.forEach((value,name) => value === undefined ? Deno.env.delete(name) : Deno.env.set(name,value));
  }
}

Deno.test('new user: real Auth invite endpoint and metadata', () => exercise({},async(send,calls)=>{
  const response=await send();assert(response.status===200);
  assert((await response.json()).message==='Invitaci\u00f3n enviada por correo.');
  const mail=calls.find(call=>call.path.startsWith('/auth/v1/invite'));
  assert(mail && (mail.body.data as Record<string,unknown>).invitation_id===invitationId);
}));
Deno.test('existing user: membership without another Auth email or account', () => exercise({kind:'existing'},async(send,calls)=>{
  const response=await send();assert(response.status===200);
  assert((await response.json()).status==='active');
  assert(!calls.some(call=>/\/invite\?|\/otp\?/.test(call.path)));
}));
Deno.test('unconfirmed account: resend Auth link without creating user', () => exercise({kind:'unconfirmed'},async(send,calls)=>{
  assert((await send()).status===200);
  const mail=calls.find(call=>call.path.startsWith('/auth/v1/otp'));
  assert(mail?.body.create_user===false);
}));
Deno.test('concurrent account creation: resolve existing membership', () => exercise({race:true},async(send)=>{
  const response=await send();assert(response.status===200);assert((await response.json()).status==='active');
}));
Deno.test('SMTP limit: error, not false delivery success', () => exercise({mailFailure:true},async(send)=>{
  const response=await send();assert(response.status===429);assert((await response.json()).error.includes('pendiente'));
}));
Deno.test('cross-organization denial stops before privileged calls', () => exercise({rpcDenied:true},async(send,calls)=>{
  assert((await send()).status===403);assert(calls.length===2);
}));
Deno.test('invalid JWT stops before RPC', () => exercise({identityDenied:true},async(send,calls)=>{
  assert((await send()).status===401);assert(calls.length===1);
}));
Deno.test('invalid role, organization and email are rejected', () => exercise({},async(send,calls)=>{
  for(const body of [null,{organization_id:'bad',email:'jessica@example.com',role:'viewer'},{organization_id:organizationId,email:'bad',role:'viewer'},{organization_id:organizationId,email:'jessica@example.com',role:'SUPER_ADMIN'}]){
    assert((await send(body)).status===400);
  }
  assert(!calls.some(call=>call.path.includes('/rpc/')));
}));
Deno.test('CORS, preflight and missing authorization', () => exercise({},async(send,calls)=>{
  assert((await send(null,{method:'OPTIONS',body:undefined})).status===204);
  assert((await send(null,{headers:{Origin:'https://other.example'}})).status===403);
  assert((await send(null,{headers:{Origin:origin}})).status===401);
  assert(calls.length===0);
}));