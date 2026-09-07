const {test}=require('node:test');
const assert=require('node:assert/strict');

test('el medio tiempo ocurre a la mitad de la duracion',()=>{
 const half=match=>Math.max(1,Math.round((Number(match.duracion)||40)*60/2));
 assert.equal(half({duracion:40}),1200);
 assert.equal(half({duracion:30}),900);
 assert.equal(half({duracion:null}),1200);
});