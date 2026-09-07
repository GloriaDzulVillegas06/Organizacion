(function(){
 const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
 const roles={out:'No convocada',available:'Convocada',starter:'Titular',substitute:'Suplente'};
 const attendance={pending:'Sin registrar',present:'Presente',excused:'Falta justificada',absent:'Falta injustificada'};
 const availability={pending:'Sin respuesta',yes:'Asistir\u00e9',no:'No podr\u00e9 asistir'};
 const states={scheduled:'Programado',live:'En juego',break:'Descanso de medio tiempo',finished:'Finalizado'};
 function summarize(matches){
  const finished=matches.filter(game=>game.status==='finished');
  const called=finished.filter(game=>game.role&&game.role!=='out');
  return {
   goals:finished.reduce((total,game)=>total+Number(game.goals||0),0),
   yellows:finished.reduce((total,game)=>total+Number(game.yellows||0),0),
   reds:finished.reduce((total,game)=>total+Number(game.reds||0),0),
   played:called.filter(game=>game.played&&game.attendance==='present').length,
   present:called.filter(game=>game.attendance==='present').length,
   excused:called.filter(game=>game.attendance==='excused').length,
   absent:called.filter(game=>game.attendance==='absent').length,
   pending:called.filter(game=>!game.attendance||game.attendance==='pending').length,
  };
 }
 const service={
  async call(name,args){
   if(window.Xolitas.DEMO_MODE)throw new Error('Este registro requiere Supabase. No se guardan asistencias simuladas.');
   const {data,error}=await window.Xolitas.supabase.rpc(name,args);
   if(error)throw new Error(error.code==='PGRST202'?'Falta aplicar la migracion 05_PANEL_JUGADORAS en Supabase.':error.message);
   return data;
  },
  mine(teamId){return this.call('player_dashboard',{p_team_id:teamId})},
  coach(teamId){return this.call('coach_attendance',{p_team_id:teamId})},
  link(playerId,email){return this.call('set_player_account',{p_player_id:playerId,p_email:email})},
  record(matchId,playerId,role,status,played){return this.call('set_match_attendance',{p_match_id:matchId,p_player_id:playerId,p_role:role,p_attendance:status,p_played:played})},
  availability(matchId,value){return this.call('set_my_availability',{p_match_id:matchId,p_availability:value})},
 };
 function options(values,selected){return Object.entries(values).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${escape(label)}</option>`).join('')}
 const date=game=>`${game.date||'Fecha pendiente'} ${String(game.time||'').slice(0,5)}`;
 const metric=(label,value)=>`<article class="stat-card"><small>${escape(label)}</small><strong>${escape(value)}</strong></article>`;
 const table=(head,rows,variant='')=>`<div class="table-scroll ${variant}" tabindex="0" role="region" aria-label="${escape(head.join(', '))}"><table class="table-admin"><thead><tr>${head.map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${head.length}">Sin registros en este periodo.</td></tr>`}</tbody></table></div>`;
 async function init(app,session,coachMode,shell){
  const teamId=window.Xolitas.team.id;
  app.innerHTML=shell(session,coachMode?'CONVOCATORIAS Y ASISTENCIA':'MI TEMPORADA',window.Xolitas.team.name,
   '<section class="player-panel"><p class="feedback" role="status" aria-live="polite">Cargando...</p><div id="player-content"></div></section>');
  const host=app.querySelector('#player-content'),feedback=app.querySelector('.feedback');
  document.title=`${coachMode?'Asistencia':'Mi temporada'} | ${window.Xolitas.team.name}`;
  const logout=document.createElement('button');logout.type='button';logout.className='secondary panel-logout';logout.textContent='Cerrar sesi\u00f3n';
  logout.onclick=async()=>{logout.disabled=true;try{await window.Xolitas.authService.logout();location.href=`./login.html?team=${encodeURIComponent(window.Xolitas.team.slug)}`}catch{logout.disabled=false;feedback.textContent='No se pudo cerrar la sesion. Vuelve a intentarlo.'}};
  app.querySelector('.topbar').appendChild(logout);
  const manager=window.Xolitas.authService.can('manageTeam');
  const notify=(text,error=false)=>{feedback.textContent=text;feedback.classList.toggle('error',error)};
  let data,selectedMatch='',league='',from='',until='',busy=false;
  const filtered=games=>games.filter(game=>(!league||game.league_id===league)&&(!from||(game.date&&game.date>=from))&&(!until||(game.date&&game.date<=until)));
  function filters(){return `<div class="filters"><div class="field"><label for="panel-league">Liga</label><select id="panel-league"><option value="">Todas las ligas</option>${window.Xolitas.leaguesService.all().map(item=>`<option value="${escape(item.id)}" ${item.id===league?'selected':''}>${escape(item.nombre)}</option>`).join('')}</select></div><div class="field"><label for="panel-from">Desde</label><input type="date" id="panel-from" value="${from}"></div><div class="field"><label for="panel-until">Hasta</label><input type="date" id="panel-until" value="${until}"></div><button class="secondary" type="button" id="panel-refresh">Actualizar</button></div>`}
  function personal(){
  if(!data.player){host.innerHTML='<p class="empty">Tu cuenta no tiene una ficha de jugadora activa vinculada en este equipo. Contacta al administrador.</p><button class="secondary" type="button" id="panel-refresh">Actualizar</button>';return}
   const games=filtered(data.matches),stats=summarize(games);
   const upcoming=games.filter(game=>game.status!=='finished');
   const previous=games.filter(game=>game.status==='finished').slice().reverse();
   const photo=data.player.photo&&/^(https?:\/\/|\.?\.?\/|\/)/.test(data.player.photo)?`<img src="${escape(data.player.photo)}" alt="${escape(data.player.name)}">`:'';
   host.innerHTML=`<div class="player-profile">${photo}<div><h2>${escape(data.player.name)}</h2><span>${data.player.number?'#'+escape(data.player.number):''}</span></div></div>${filters()}
    <div class="stats-grid">${metric('Goles',stats.goals)+metric('Partidos jugados',stats.played)+metric('Amarillas / Rojas',`${stats.yellows} / ${stats.reds}`)+metric('Asistencias',stats.present)+metric('Faltas justificadas',stats.excused)+metric('Faltas injustificadas',stats.absent)+metric('Asistencia sin registrar',stats.pending)}</div>
    <h2>PROXIMOS PARTIDOS</h2>${table(['Fecha / Cancha','Rival','Convocatoria','Disponibilidad'],upcoming.map(game=>`<tr><td>${escape(date(game))}<br>${escape(game.venue)}</td><td>${escape(game.opponent)}<br>${escape(states[game.status])}</td><td>${escape(roles[game.role]||'Sin convocatoria')}</td><td>${game.role&&game.role!=='out'&&game.status==='scheduled'?`<form data-availability="${game.id}"><label for="availability-${game.id}" class="sr-only">Disponibilidad</label><select id="availability-${game.id}" name="availability">${options(availability,game.availability||'pending')}</select><button class="primary" type="submit">Confirmar</button></form>`:escape(availability[game.availability]||'No aplica')}</td></tr>`).join(''))}
    <h2>MI HISTORIAL</h2>${table(['Fecha / Rival','Resultado','Participacion','Goles','Asistencia'],previous.map(game=>`<tr><td>${escape(date(game))}<br>${escape(game.opponent)}</td><td>${game.goals_for} - ${game.goals_against}</td><td>${game.played?'Jugo':game.role&&game.role!=='out'?'Sin participacion registrada':roles[game.role]||'Sin convocatoria'}</td><td>${game.goals}</td><td>${game.role&&game.role!=='out'?attendance[game.attendance||'pending']:'No aplica'}</td></tr>`).join(''))}`;
  }
  function coaching(){
   const games=filtered(data.matches);
   if(!games.some(game=>game.id===selectedMatch))selectedMatch=games.find(game=>game.status==='scheduled')?.id||games[0]?.id||'';
   const selected=games.find(game=>game.id===selectedMatch);
   const summary=data.players.map(player=>{
    const records=games.map(game=>({...game,...data.rosters.find(row=>row.match_id===game.id&&row.player_id===player.id)}));
    const stats=summarize(records);
    return `<tr><td>${escape(player.name)}${player.active?'':' (Inactiva)'}</td><td>${stats.played}</td><td>${stats.present}</td><td>${stats.excused}</td><td>${stats.absent}</td><td>${stats.pending}</td></tr>`;
   }).join('');
   const rows=selected?data.players.filter(player=>player.active||data.rosters.some(row=>row.match_id===selected.id&&row.player_id===player.id)).map(player=>{
    const row=data.rosters.find(record=>record.match_id===selected.id&&record.player_id===player.id)||{role:'out',attendance:'pending',played:false};
    return `<tr><td>${escape(player.name)}</td><td>${escape(availability[row.availability]||'Sin respuesta')}</td><td><form class="record-form" data-player="${player.id}"><select name="role" aria-label="Convocatoria de ${escape(player.name)}">${options(roles,row.role)}</select><select name="attendance" aria-label="Asistencia de ${escape(player.name)}" ${selected.status==='scheduled'?'disabled':''}>${options(attendance,row.attendance)}</select><label><input name="played" type="checkbox" ${row.played?'checked':''} ${selected.status==='scheduled'?'disabled':''}> Jugo</label><button class="primary" type="submit">Guardar</button></form></td></tr>`;
   }).join(''):'';
   host.innerHTML=`${filters()}<h2>RESUMEN POR JUGADORA</h2>${table(['Jugadora','Partidos jugados','Presente','Justificada','Injustificada','Sin registrar'],summary)}
    <h2>LISTA DEL PARTIDO</h2><div class="filters"><div class="field"><label for="attendance-match">Partido</label><select id="attendance-match">${games.length?games.map(game=>`<option value="${game.id}" ${game.id===selectedMatch?'selected':''}>${escape(date(game))} / ${escape(game.opponent)} / ${escape(states[game.status])}</option>`).join(''):'<option value="">Sin partidos</option>'}</select></div></div>${table(['Jugadora','Disponibilidad','Registro del entrenador'],rows,'record-table')}
    ${manager?`<h2>CUENTAS DE JUGADORAS</h2>${table(['Jugadora','Cuenta vinculada','Vinculacion'],data.players.map(player=>`<tr><td>${escape(player.name)}</td><td>${escape(player.email||'Sin vincular')}</td><td><form class="link-form" data-link="${player.id}"><input type="email" name="email" maxlength="254" required autocomplete="off" aria-label="Correo de ${escape(player.name)}" value="${escape(player.email||'')}"><button class="primary" type="submit">Vincular</button>${player.email?`<button class="secondary" type="button" data-unlink="${player.id}">Desvincular</button>`:''}</form></td></tr>`).join(''),'link-table')}`:''}`;
  }
  function render(){
   coachMode?coaching():personal();
   host.querySelectorAll('table').forEach(element=>{
    const labels=[...element.querySelectorAll('th')].map(header=>header.textContent);
    element.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,index)=>{if(cell.colSpan===1)cell.dataset.label=labels[index]}));
   });
  }
  async function load(){data=await (coachMode?service.coach(teamId):service.mine(teamId));render();}
  async function action(operation,message){
   if(busy)return;busy=true;host.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);notify('Guardando...');
   try{await operation();await load();notify(message)}
   catch(error){if(data)render();notify(error.message,true)}finally{busy=false}
  }
  host.addEventListener('change',event=>{
   if(busy)return;
   if(event.target.id==='panel-league')league=event.target.value;
   else if(event.target.id==='panel-from')from=event.target.value;
   else if(event.target.id==='panel-until')until=event.target.value;
   else if(event.target.id==='attendance-match')selectedMatch=event.target.value;
   else if(event.target.name==='role'){
    const form=event.target.form;
    if(event.target.value==='out'){form.elements.attendance.value='pending';form.elements.played.checked=false}
    return;
   }else return;
   render();
  });
  host.addEventListener('click',event=>{
   const target=event.target.closest('button');if(!target||busy)return;
   if(target.id==='panel-refresh')action(async()=>{},'Datos actualizados.');
   if(target.dataset.unlink&&confirm('Desvincular esta cuenta de la ficha de jugadora?'))action(()=>service.link(target.dataset.unlink,null),'Cuenta desvinculada.');
  });
  host.addEventListener('submit',event=>{
   event.preventDefault();if(busy)return;const form=event.target;
   if(form.dataset.availability)action(()=>service.availability(form.dataset.availability,form.elements.availability.value),'Disponibilidad confirmada.');
   if(form.dataset.player){
    const role=form.elements.role.value,status=form.elements.attendance.value,played=form.elements.played.checked;
    action(()=>service.record(selectedMatch,form.dataset.player,role,status,played),'Registro guardado.');
   }
   if(form.dataset.link){
    const email=form.elements.email.value.trim();
    if(confirm(`Vincular ${email} a esta ficha?`))action(()=>service.link(form.dataset.link,email),'Cuenta vinculada.');
   }
  });
  try{await load();notify('')}catch(error){notify(error.message,true);host.innerHTML='<button class="secondary" type="button" id="panel-refresh">Reintentar</button>'}
 }
 window.PlayerPanel={init,service,summarize};
})();