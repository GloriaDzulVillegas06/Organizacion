const { authService, playersService, matchesService, eventsService } = window.Xolitas;
let TEAM=window.TeamContext?.team||{name:'Xolitas F.C.',shortName:'XOLITAS',logo:'../assets/xolitas-crest.png'};
let TEAM_SLUG=window.TeamContext?.slug||'xolitas';
const teamUpper=()=>String(TEAM.shortName||TEAM.name).toUpperCase();
const qTeam=(href)=>`${href}${href.includes('?')?'&':'?'}team=${encodeURIComponent(TEAM_SLUG)}`;

let match;
let ticking = false;
let timerId;
let pendingEventType = '';
const app = document.querySelector('#match-app');
window.Xolitas.ready.then(async()=>{TEAM=window.TeamContext?.team||TEAM;TEAM_SLUG=window.TeamContext?.slug||TEAM_SLUG;const session=authService.require();if(!session||!authService.can('capture')){if(session)location.href='./dashboard.html';return}const requestedId=new URLSearchParams(location.search).get('id'),existing=matchesService.active(),selected=matchesService.all().find(m=>String(m.id)===String(requestedId))||matchesService.all().find(m=>m.estado==='programado');if(!selected)throw new Error('No hay un partido programado para iniciar.');const canResume=existing&&String(existing.id)===String(selected.id)&&existing.estado!=='finalizado';match=canResume?existing:{...selected,estado:selected.estado||'programado',golesXolitas:+(selected.golesXolitas||0),golesRival:+(selected.golesRival||0),elapsed:0,phase:'PRIMER TIEMPO'};if(!canResume)matchesService.setActive(null);matchesService.setActive(match);await eventsService.sync(match.id);render()}).catch(error=>{app.innerHTML=`<p class="empty">No se pudo preparar el partido: ${error.message}</p>`});

function render() {
  app.classList.remove('admin-loader');
  const events = eventsService.forMatch(match.id);
  app.innerHTML = `<section class="match-page">
    <header class="match-top"><a class="back" href="${qTeam('./dashboard.html')}">← Panel</a><span class="live">${match.estado==='jugando'?'<i></i> EN VIVO':'LISTO PARA INICIAR'}</span><span class="phase">${match.phase}</span></header>
    <section class="scoreboard"><div class="club"><img src="${TEAM.logo}" alt="Escudo ${TEAM.name}"><strong>${teamUpper()}</strong></div><div class="score"><b id="us">${match.golesXolitas}</b><span>—</span><b id="them">${match.golesRival}</b></div><div class="club"><img src="${match.logoRival||'../assets/default-rival.svg'}" alt="Escudo de ${match.rival}" onerror="this.onerror=null;this.src='../assets/default-rival.svg'"><strong>${match.rival.toUpperCase()}</strong></div></section>
    <div class="timer" id="timer">${clock(match.elapsed || 0)}</div><div class="timer-controls"><button id="toggle-time">${ticking ? 'Ⅱ Pausar cronómetro' : '▶ Iniciar cronómetro'}</button></div>
    <section class="actions"><button class="action goal-us" id="goal-us">⚽ + GOL ${teamUpper()}</button><button class="action goal-them" id="goal-them">+ Gol rival</button><button class="action own-goal" id="own-goal">↺ Autogol</button><button class="action event" id="event">▣ Tarjeta / expulsión</button><button class="action break" id="break">Descanso</button><button class="action finish" id="finish">Finalizar partido</button></section>
    <div class="event-maintenance"><button class="undo" id="undo">↶ Deshacer último evento</button><button class="reset-events" id="reset-events">↺ Reiniciar prueba</button></div><section class="timeline"><h2>LÍNEA DEL PARTIDO</h2><div>${events.length ? events.slice().reverse().map(eventHTML).join('') : '<p class="empty">Los eventos aparecerán aquí.</p>'}</div></section>
  </section>${scorerSheet()}${ownGoalSheet()}${eventTypeSheet()}${eventPlayerSheet()}${confirmDialog()}
  <div class="goal-flash" id="goal-flash"><span class="star">✦</span><small>¡GOOOOOOL!</small><h2 id="scorer-name"></h2><b id="scorer-num"></b></div>
  <section class="final-screen" id="final"><img src="${TEAM.logo}" alt="${TEAM.name}"><small>FINAL</small><h2>${teamUpper()} — ${match.rival.toUpperCase()}</h2><div class="final-score">${match.golesXolitas} — ${match.golesRival}</div><h3>GOLEADORAS</h3><ul>${events.filter(e => e.tipo === 'gol_xolitas').map(e => `<li>⚽ ${e.jugadoraNombre} &nbsp; ${eventTime(e)}</li>`).join('')}</ul><div class="final-actions"><a href="${qTeam('./dashboard.html')}">Volver al panel</a><button type="button" id="close-match">Cerrar página</button></div></section>`;
  bind();
}

function playerButtons(attribute) {
  const expelled = expelledPlayerIds();
  return playersService.all().filter(p => p.activa).map(p => `<button class="player-option ${expelled.has(p.id) ? 'is-expelled' : ''}" ${expelled.has(p.id) ? 'disabled' : ''} ${attribute}="${p.id}"><b>#${p.numero}</b><span>${p.nombre}<br><small>${expelled.has(p.id) ? 'EXPULSADA' : p.posicion}</small></span></button>`).join('');
}
function scorerSheet() { return `<dialog class="sheet" id="scorer-sheet"><div class="sheet-head"><h2>¿QUIÉN ANOTÓ?</h2><button data-close>×</button></div><div class="player-options">${playerButtons('data-scorer')}</div></dialog>`; }
function ownGoalSheet() { return `<dialog class="sheet" id="own-goal-sheet"><div class="sheet-head"><h2>REGISTRAR AUTOGOL</h2><button data-close>×</button></div><div class="event-types own-goal-types"><button data-own-goal="favor"><span>⚽</span><b>A favor de ${TEAM.shortName||TEAM.name}<small>Lo cometió el equipo rival</small></b></button><button data-own-goal="contra"><span>↺</span><b>En contra de ${TEAM.shortName||TEAM.name}<small>Seleccionar jugadora</small></b></button></div></dialog>`; }
function eventTypeSheet() { return `<dialog class="sheet" id="event-type-sheet"><div class="sheet-head"><h2>REGISTRAR EVENTO</h2><button data-close>×</button></div><div class="event-types"><button data-event-type="amarilla"><span>🟨</span><b>Tarjeta amarilla</b></button><button data-event-type="segunda_amarilla"><span>🟨🟥</span><b>Segunda amarilla</b></button><button data-event-type="roja"><span>🟥</span><b>Tarjeta roja</b></button><button data-event-type="expulsion"><span>⬛</span><b>Expulsión</b></button></div></dialog>`; }
function eventPlayerSheet() { return `<dialog class="sheet" id="event-player-sheet"><div class="sheet-head"><h2 id="event-player-title">SELECCIONA JUGADORA</h2><button data-close>×</button></div><div class="player-options">${playerButtons('data-card-player')}</div></dialog>`; }
function confirmDialog() { return `<dialog class="confirm" id="confirm"><h2 id="confirm-title">CONFIRMAR</h2><p id="confirm-copy"></p><div class="confirm-actions"><button data-close>Cancelar</button><button class="yes" id="confirm-yes">Confirmar</button></div></dialog>`; }

function bind() {
  document.querySelector('#goal-us').onclick = () => document.querySelector('#scorer-sheet').showModal();
  document.querySelector('#event').onclick = () => document.querySelector('#event-type-sheet').showModal();
  document.querySelector('#own-goal').onclick = () => document.querySelector('#own-goal-sheet').showModal();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  document.querySelectorAll('[data-scorer]').forEach(b => b.onclick = () => addOurGoal(b.dataset.scorer));
  document.querySelectorAll('[data-event-type]').forEach(b => b.onclick = () => chooseEventType(b.dataset.eventType));
  document.querySelectorAll('[data-own-goal]').forEach(b => b.onclick = () => chooseOwnGoal(b.dataset.ownGoal));
  document.querySelectorAll('[data-card-player]').forEach(b => b.onclick = () => addDisciplinaryEvent(b.dataset.cardPlayer));
  document.querySelector('#goal-them').onclick = addRivalGoal;
  document.querySelector('#toggle-time').onclick = toggleTimer;
  document.querySelector('#break').onclick = () => { match.phase = match.phase === 'DESCANSO' ? 'SEGUNDO TIEMPO' : 'DESCANSO'; saveRender(true); };
  document.querySelector('#undo').onclick = confirmUndo;
  document.querySelector('#reset-events').onclick = confirmReset;
  document.querySelector('#finish').onclick = confirmFinish;
  document.querySelector('#close-match').onclick = closeMatchPage;
}

function chooseEventType(type) {
  pendingEventType = type;
  document.querySelector('#event-type-sheet').close();
  const labels = { amarilla: 'AMARILLA PARA…', segunda_amarilla:'SEGUNDA AMARILLA PARA…', roja: 'ROJA PARA…', expulsion: 'EXPULSAR A…' };
  document.querySelector('#event-player-title').textContent = labels[type];
  document.querySelector('#event-player-sheet').showModal();
}
async function chooseOwnGoal(direction) {
  document.querySelector('#own-goal-sheet').close();
  if (direction === 'favor') { await addEvent({ matchId:match.id, tipo:'autogol_favor', ...currentEventTime() }); match.golesXolitas++; saveRender(); return; }
  pendingEventType = 'autogol_contra';
  document.querySelector('#event-player-title').textContent = '¿QUIÉN COMETIÓ EL AUTOGOL?';
  document.querySelector('#event-player-sheet').showModal();
}
async function addDisciplinaryEvent(id) {
  const p = playersService.all().find(x => x.id === id);
  await addEvent({ matchId: match.id, jugadoraId: p.id, jugadoraNombre: p.nombre, jugadoraNumero: p.numero, tipo: pendingEventType, ...currentEventTime() });
  if (pendingEventType === 'autogol_contra') match.golesRival++;
  document.querySelector('#event-player-sheet').close();
  saveRender();
}
async function addOurGoal(id) {
  const p = playersService.all().find(x => x.id === id);
  await addEvent({ matchId: match.id, jugadoraId: p.id, jugadoraNombre: p.nombre, tipo: 'gol_xolitas', ...currentEventTime() });
  match.golesXolitas++;
  matchesService.setActive(match);
  document.querySelector('#scorer-sheet').close();
  document.querySelector('#scorer-name').textContent = p.nombre.toUpperCase();
  document.querySelector('#scorer-num').textContent = '#' + p.numero;
  document.querySelector('#us').textContent = match.golesXolitas;
  const flash = document.querySelector('#goal-flash'); flash.classList.remove('show-goal'); void flash.offsetWidth; flash.classList.add('show-goal');
  setTimeout(render, 2050);
}
async function addRivalGoal() { await addEvent({ matchId: match.id, tipo: 'gol_rival', ...currentEventTime() }); match.golesRival++; saveRender(); }
async function addEvent(event) {
  try { await eventsService.add(event); }
  catch(error) { alert(`No se pudo guardar el evento: ${error.message}`); throw error; }
}
function confirmUndo() {
  const events = eventsService.forMatch(match.id); if (!events.length) return;
  const last = events.at(-1), d = document.querySelector('#confirm');
  document.querySelector('#confirm-title').textContent = '¿DESHACER EVENTO?';
  document.querySelector('#confirm-copy').textContent = `Se eliminará: ${eventLabel(last)}.`;
  document.querySelector('#confirm-yes').onclick = async () => { const button=document.querySelector('#confirm-yes');button.disabled=true;try{await eventsService.undo(match.id);if (['gol_xolitas','autogol_favor'].includes(last.tipo)) match.golesXolitas = Math.max(0, match.golesXolitas - 1);if (['gol_rival','autogol_contra'].includes(last.tipo)) match.golesRival = Math.max(0, match.golesRival - 1);d.close();saveRender()}catch(error){document.querySelector('#confirm-copy').textContent=`No se pudo deshacer: ${error.message}`}finally{button.disabled=false} };
  d.showModal();
}
function confirmReset() {
  const events = eventsService.forMatch(match.id), d = document.querySelector('#confirm');
  document.querySelector('#confirm-title').textContent = '¿REINICIAR PRUEBA?';
  document.querySelector('#confirm-copy').textContent = `Se eliminarán ${events.length} eventos, el marcador quedará 0 — 0 y el cronómetro volverá a 00:00.`;
  document.querySelector('#confirm-yes').onclick = async () => {
    const button = document.querySelector('#confirm-yes'); button.disabled = true; button.textContent = 'Reiniciando…'; clearInterval(timerId); ticking = false;
    try { await eventsService.clearMatch(match.id); Object.assign(match,{golesXolitas:0,golesRival:0,elapsed:0,phase:'PRIMER TIEMPO',estado:'programado'}); matchesService.setActive(match); d.close(); render(); }
    catch(error) { document.querySelector('#confirm-copy').textContent = `No se pudo reiniciar: ${error.message}`; button.disabled = false; button.textContent = 'Reintentar'; }
  };
  d.showModal();
}
function confirmFinish() { const d = document.querySelector('#confirm'); document.querySelector('#confirm-title').textContent = '¿FINALIZAR PARTIDO?'; document.querySelector('#confirm-copy').textContent = `${TEAM.shortName||TEAM.name} ${match.golesXolitas} — ${match.golesRival} ${match.rival}`; document.querySelector('#confirm-yes').onclick = async () => { try { clearInterval(timerId); ticking = false; await matchesService.finish(match.id); match.estado = 'finalizado'; await matchesService.save(match); matchesService.setActive(null); d.close(); document.querySelector('#final').classList.add('show'); } catch(error) { document.querySelector('#confirm-copy').textContent = `No se pudo finalizar: ${error.message}`; } }; d.showModal(); }
async function toggleTimer() { const btn=document.querySelector('#toggle-time');if(!ticking&&match.estado!=='jugando'){btn.disabled=true;btn.textContent='Iniciando…';try{await matchesService.start(match.id);match.estado='jugando';matchesService.setActive(match);ticking=true;render();startClock();return}catch(error){btn.disabled=false;btn.textContent='▶ Iniciar cronómetro';alert(`No se pudo iniciar el partido: ${error.message}`);return}}ticking=!ticking;btn.textContent=ticking?'Ⅱ Pausar cronómetro':'▶ Continuar cronómetro';if(ticking)startClock();else clearInterval(timerId)}
function startClock(){clearInterval(timerId);timerId=setInterval(()=>{match.elapsed=(match.elapsed||0)+1;const timer=document.querySelector('#timer');if(timer)timer.textContent=clock(match.elapsed);if(match.elapsed%10===0)matchesService.setActive(match)},1000)}
function saveRender(stopTimer = false) { if (stopTimer) { clearInterval(timerId); ticking = false; } matchesService.setActive(match); render(); }
function expelledPlayerIds() { return new Set(eventsService.forMatch(match.id).filter(e => ['roja','segunda_amarilla','expulsion'].includes(e.tipo)).map(e => e.jugadoraId)); }
function eventLabel(e) { return ({ gol_xolitas: `Gol de ${e.jugadoraNombre}`, gol_rival: `Gol de ${match.rival}`, autogol_favor: `Autogol de ${match.rival} a favor de ${TEAM.shortName||TEAM.name}`, autogol_contra: `Autogol de ${e.jugadoraNombre}`, amarilla: `Amarilla a ${e.jugadoraNombre}`, segunda_amarilla:`Segunda amarilla a ${e.jugadoraNombre}`, roja: `Roja a ${e.jugadoraNombre}`, expulsion: `Expulsión de ${e.jugadoraNombre}` })[e.tipo] || e.tipo; }
function eventHTML(e) { const icons = { gol_xolitas: '⚽', gol_rival: '◆', autogol_favor:'↺', autogol_contra:'↺', amarilla: '🟨', segunda_amarilla:'🟨🟥', roja: '🟥', expulsion: '⬛' }; return `<div class="event-row event-row--${e.tipo}"><time>${eventTime(e)}</time><span>${icons[e.tipo] || '•'}</span><strong>${eventLabel(e)}</strong></div>`; }
function currentEventTime() { const elapsed = Math.max(0, Math.floor(match.elapsed || 0)); return { minuto: Math.floor(elapsed / 60), segundo: elapsed % 60 }; }
function eventTime(e) { const minute = Math.max(0, Number(e.minuto) || 0), second = Math.max(0, Number(e.segundo) || 0); return minute ? `${minute}:${String(second).padStart(2, '0')}` : `${second}s`; }
function closeMatchPage() { window.close(); setTimeout(() => { if (!window.closed) location.href = qTeam('./dashboard.html'); }, 250); }
function clock(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
