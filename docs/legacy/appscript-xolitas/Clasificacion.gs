/* Clasificación del torneo para Xolitas F.C. */

function prepararClasificacion() {
  ensureSheet_(SHEETS.standings, ['id','equipo','g','e','p','gf','gc','pe','logo']);
  if (rows_(SHEETS.standings).length) return 'La clasificación ya tiene datos';
  var initial = [
    ['Guillen FC',4,0,0,26,3,0], ['Xolitas FC',4,0,0,26,5,0],
    ['Guerreras',4,0,1,14,10,0], ['Marshall FC',1,1,2,19,9,0],
    ['Guerreras Xcumpich',1,0,3,6,17,0], ['Atlétic FC',0,1,3,5,19,0],
    ['Cobras FC',0,0,5,2,35,0]
  ];
  initial.forEach(function (row) {
    appendObject_(SHEETS.standings,{id:nextId_(SHEETS.standings,'EQ'),equipo:row[0],g:row[1],e:row[2],p:row[3],gf:row[4],gc:row[5],pe:row[6],logo:''});
  });
  return 'Clasificación preparada correctamente';
}

function getStandings_() {
  return rows_(SHEETS.standings).map(normalizeStanding_).sort(sortStandings_);
}

function saveStanding_(data,isNew) {
  return locked_(function () {
    var id=isNew?nextId_(SHEETS.standings,'EQ'):String(data.standingId||data.id||'');
    if(!id)throw new Error('Falta el ID del equipo');
    var value={id:id,equipo:String(data.equipo||'').trim(),g:num_(data.g),e:num_(data.e),p:num_(data.p),gf:num_(data.gf),gc:num_(data.gc),pe:num_(data.pe),logo:String(data.logo||'').trim()};
    if(!value.equipo)throw new Error('Escribe el nombre del equipo');
    isNew?appendObject_(SHEETS.standings,value):updateObject_(SHEETS.standings,id,value);
    return normalizeStanding_(value);
  });
}

function deleteStanding_(id) {
  return locked_(function () {
    var sheet=sheet_(SHEETS.standings),data=sheet.getDataRange().getValues(),headers=headerMap_(data[0]);
    for(var row=1;row<data.length;row++)if(String(data[row][headers.id])===String(id)){sheet.deleteRow(row+1);return{id:id};}
    throw new Error('Equipo no encontrado');
  });
}

function normalizeStanding_(row) {
  row.g=num_(row.g);row.e=num_(row.e);row.p=num_(row.p);row.gf=num_(row.gf);row.gc=num_(row.gc);row.pe=num_(row.pe);
  row.j=row.g+row.e+row.p;row.pts=row.g*3+row.e+row.pe;row.dif=row.gf-row.gc;row.porcentaje=row.j?Math.round(row.pts/(row.j*3)*100):0;
  return row;
}

function sortStandings_(a,b) { return b.pts-a.pts||b.dif-a.dif||b.gf-a.gf||String(a.equipo).localeCompare(String(b.equipo)); }
