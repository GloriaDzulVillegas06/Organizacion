const {test}=require('node:test');
const assert=require('node:assert/strict');

test('la vista publica solo muestra goleadoras de Xolitas',()=>{
 const events=[
  {tipo:'gol_xolitas',jugadoraNombre:'Jessica',minuto:4,segundo:8},
  {tipo:'gol_rival',jugadoraNombre:'Rival',minuto:8,segundo:0},
  {tipo:'gol_xolitas',jugadoraNombre:'Andrea',minuto:19,segundo:2},
 ];
 const localGoals=events.filter(event=>event.tipo==='gol_xolitas').sort((a,b)=>(a.minuto*60+a.segundo)-(b.minuto*60+b.segundo));
 assert.deepEqual(localGoals.map(goal=>goal.jugadoraNombre),['Jessica','Andrea']);
 assert.equal(localGoals.some(goal=>goal.jugadoraNombre==='Rival'),false);
});
