export const mockPlayers = [
  ['p1',10,'Jessica','Hernández','Delantera',12,14,0],['p2',7,'Andrea','Torres','Mediocampista',9,14,1],
  ['p3',21,'Fernanda','Ruiz','Delantera',6,12,2],['p4',4,'Mariana','López','Defensa',3,14,3],
  ['p5',1,'Karla','Pérez','Portera',0,13,0],['p6',2,'Lucía','Méndez','Defensa',1,11,1],
  ['p7',5,'Paola','Díaz','Defensa',0,10,2],['p8',8,'Sofía','Castro','Mediocampista',4,13,3],
  ['p9',11,'Ximena','Vega','Delantera',5,9,0],['p10',14,'Daniela','Cruz','Mediocampista',2,12,1],
  ['p11',17,'Valeria','Mora','Defensa',1,8,2],['p12',23,'Renata','León','Portera',0,4,3]
].map(([id,numero,nombre,apellido,posicion,goles,partidos,foto])=>({id,numero,nombre,apellido,posicion,goles,partidos,foto,activa:true}));

export const mockMatches = [
  {id:'m1',fecha:'2026-08-22',hora:'19:00',rival:'Panteras',lugar:'Cancha Municipal',torneo:'Liga Municipal',jornada:9,estado:'programado',golesXolitas:0,golesRival:0},
  {id:'m2',fecha:'2026-08-29',hora:'18:00',rival:'Guerreras',lugar:'Unidad Deportiva',torneo:'Liga Municipal',jornada:10,estado:'programado',golesXolitas:0,golesRival:0},
  {id:'m3',fecha:'2026-08-15',hora:'19:00',rival:'Amazonas',lugar:'Cancha Municipal',torneo:'Liga Municipal',jornada:8,estado:'finalizado',golesXolitas:4,golesRival:2},
  {id:'m4',fecha:'2026-08-08',hora:'18:00',rival:'Leonas',lugar:'Unidad Deportiva',torneo:'Liga Municipal',jornada:7,estado:'finalizado',golesXolitas:2,golesRival:0},
  {id:'m5',fecha:'2026-08-01',hora:'20:00',rival:'Águilas',lugar:'Cancha Norte',torneo:'Liga Municipal',jornada:6,estado:'finalizado',golesXolitas:1,golesRival:1},
  {id:'m6',fecha:'2026-07-25',hora:'19:00',rival:'Fénix',lugar:'Cancha Municipal',torneo:'Liga Municipal',jornada:5,estado:'finalizado',golesXolitas:3,golesRival:1},
  {id:'m7',fecha:'2026-07-18',hora:'17:00',rival:'Centellas',lugar:'Cancha Sur',torneo:'Liga Municipal',jornada:4,estado:'finalizado',golesXolitas:0,golesRival:1}
];
