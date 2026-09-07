const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function runtime({members=[],platformRole=null,functionError=null}={}){
 const stored=new Map(),calls=[];
 const session={user:{id:'user',email:'test@example.com'}};
 const tables={teams:{id:'team-a',organization_id:'org-a',slug:'xolitas',name:'Xolitas'},team_branding:null,team_site_settings:null,platform_users:platformRole?{role:platformRole}:null,organization_members:members};
 const sb={
  auth:{getSession:async()=>({data:{session}}),signInWithPassword:async()=>({data:{session}}),signOut:async()=>({})},
  from(table){const query={then(resolve){resolve({data:tables[table]??(table==='team_branding'||table==='team_site_settings'||table==='platform_users'?null:[]),error:null})}};for(const method of ['select','eq','order','maybeSingle'])query[method]=()=>query;return query},
  functions:{invoke:async(name,options)=>{calls.push({name,...options});return {data:{message:'Invitacion enviada'},error:functionError}}},
  channel(){const channel={on:()=>channel,subscribe:()=>null};return channel},
 };
 const document={body:{dataset:{page:'dashboard'}},documentElement:{style:{setProperty(){}}},querySelector:()=>null,title:''};
 const window={XOLITAS_CONFIG:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable-test',BASE_PATH:'/Organizacion'},supabase:{createClient:()=>sb},dispatchEvent(){}};
 const location={pathname:'/Organizacion/admin/dashboard.html',search:'?team=xolitas',href:''};
 vm.runInNewContext(fs.readFileSync('assets/js/runtime.js','utf8'),{window,document,location,localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},URLSearchParams,console,Event,CustomEvent,crypto:globalThis.crypto});
 await window.Xolitas.ready;
 return {app:window.Xolitas,calls,location};
}

test('un rol de otra organizacion no autoriza el equipo actual',async()=>{
 const {app,location}=await runtime({members:[{organization_id:'org-b',role:'owner'}]});
 assert.equal((await app.authService.session()).role,null);
 assert.equal(app.authService.can('manageMembers'),false);
 assert.equal(app.authService.can('capture'),false);
 assert.equal(app.authService.require(),null);
 assert.match(location.href,/\/Organizacion\/admin\/login.html\?team=xolitas$/);
});

test('login hidrata los permisos del equipo y logout los limpia',async()=>{
 const {app}=await runtime({members:[{organization_id:'org-a',role:'admin'}]});
 await app.authService.login('test@example.com','password');
 assert.equal(app.authService.can('manageMembers'),true);
 await app.authService.logout();
 assert.equal(app.authService.can('manageMembers'),false);
});

test('SUPER_ADMIN puede administrar roles sin suplantar el rol organizacional',async()=>{
 const {app}=await runtime({platformRole:'super_admin'});
 assert.equal((await app.authService.session()).platformRole,'super_admin');
 assert.equal(app.authService.can('manageTeam'),true);
 assert.equal(app.authService.can('manageMembers'),true);
});

test('inviteMember usa Edge Function, email normalizado y rol solicitado',async()=>{
 const {app,calls}=await runtime();
 assert.equal((await app.platformService.inviteMember('org-a',' Jessica@Example.com ','capturista')).message,'Invitacion enviada');
 assert.equal(JSON.stringify(calls),JSON.stringify([{name:'invite-member',body:{organization_id:'org-a',email:'jessica@example.com',role:'capturista'}}]));
});

test('inviteMember muestra errores HTTP y tolera errores de red sin JSON',async()=>{
 const http=await runtime({functionError:{context:{json:async()=>({error:'Sin permiso'})}}});
 await assert.rejects(http.app.platformService.inviteMember('org-a','mail@example.com','viewer'),/Sin permiso/);
 const network=await runtime({functionError:new Error('offline')});
 await assert.rejects(network.app.platformService.inviteMember('org-a','mail@example.com','viewer'),/Comprueba tu sesi/);
});