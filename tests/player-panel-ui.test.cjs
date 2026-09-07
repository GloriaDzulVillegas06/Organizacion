const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(rpc,demo=false){
 const window={Xolitas:{DEMO_MODE:demo,supabase:{rpc}}};
 vm.runInNewContext(fs.readFileSync('assets/js/player-panel.js','utf8'),{window});
 return window.PlayerPanel;
}
test('resumen: solo participacion y asistencia registradas en partidos terminados',()=>{
 const panel=load();
 const summary=panel.summarize([
  {status:'finished',role:'starter',attendance:'present',played:true,goals:2,yellows:1},
  {status:'finished',role:'substitute',attendance:'present',played:false},
  {status:'finished',role:'available',attendance:'excused'},
  {status:'finished',role:'available',attendance:'absent'},
  {status:'finished',role:'available',attendance:'pending'},
  {status:'finished',role:'out',attendance:'absent'},
  {status:'finished',role:null},
  {status:'scheduled',role:'available',attendance:'absent',played:true,goals:7},
  {status:'cancelled',role:'starter',attendance:'absent',played:true,goals:9},
 ]);
 assert.deepEqual(JSON.parse(JSON.stringify(summary)),{goals:2,yellows:1,reds:0,played:1,present:2,excused:1,absent:1,pending:1});
});
test('servicio de jugadora no envia identidad ni asistencia al confirmar disponibilidad',async()=>{
 const calls=[];
 const panel=load(async(name,args)=>{calls.push({name,args});return {data:{ok:true}}});
 await panel.service.availability('match-a','yes');
 await panel.service.mine('team-a');
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {name:'set_my_availability',args:{p_match_id:'match-a',p_availability:'yes'}},
  {name:'player_dashboard',args:{p_team_id:'team-a'}},
 ]);
});
test('errores de migracion y modo demo no anuncian registros exitosos',async()=>{
 const missing=load(async()=>({error:{code:'PGRST202',message:'missing'}}));
 await assert.rejects(missing.service.mine('team-a'),/05_PANEL_JUGADORAS/);
 const demo=load(()=>{throw new Error('No debe llamar al backend en demo')},true);
 await assert.rejects(demo.service.availability('match-a','yes'),/requiere Supabase/);
});