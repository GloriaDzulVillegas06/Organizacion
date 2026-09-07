let players = [];
let selectedLeagueId = '';
let selectedPosition = '';

let TEAM = window.TeamContext?.team || {name:'Xolitas F.C.',shortName:'XOLITAS',suffix:'F.C.',logo:'./assets/xolitas-crest.png',paw:'./assets/xolitas-paw.png',season:'Temporada 2026',copy:{}};
let COPY = TEAM.copy || {};
const esc = value => escapePublic(String(value ?? ''));
const teamNameUpper = () => String(TEAM.shortName || TEAM.name || 'EQUIPO').toUpperCase();
const teamDisplay = () => `${esc(TEAM.shortName || TEAM.name)}${TEAM.suffix ? ` <b>${esc(TEAM.suffix)}</b>` : ''}`;
let DEFAULT_RIVAL = `${window.TeamContext?.basePath||''}/assets/default-rival.svg`;
function refreshTeamContext(){ TEAM=window.TeamContext?.team||TEAM; COPY=TEAM.copy||{}; DEFAULT_RIVAL=`${window.TeamContext?.basePath||''}/assets/default-rival.svg`; }

function Crest({ small = false } = {}) {
  return `<div class="crest ${small ? 'crest--small' : ''}">
    <img src="${esc(TEAM.logo)}" alt="Escudo oficial de ${esc(TEAM.name)}">
  </div>`;
}

function renderSite(){
refreshTeamContext();
const matches=window.Xolitas.matchesService.all(),today=new Date().toISOString().slice(0,10),live=matches.find(m=>m.estado==='jugando'),upcoming=matches.filter(m=>m.estado==='programado'||(m.estado==='descanso'&&String(m.fecha)>=today)).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))),last=matches.filter(m=>m.estado==='finalizado').sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))[0],nextEntry=live||upcoming[0],next=upcoming.find(m=>m.estado==='programado')||live;
const leagues=window.Xolitas.leaguesService.all(),sponsors=(window.Xolitas.sponsorsService?.all()||[]).filter(s=>s.activo&&s.logo).sort((a,b)=>a.orden-b.orden),standings=window.Xolitas.standingsService?.all()||[],teamFirst=String(standings[0]?.equipo||'').toLowerCase().includes(String(TEAM.shortName||TEAM.name).toLowerCase()),selectedLeague=leagues.find(l=>String(l.id)===String(selectedLeagueId)),statPlayers=players.map(p=>({...p,goals:selectedLeagueId?+(p.goalsByLeague?.[selectedLeagueId]||0):p.goals})).sort((a,b)=>b.goals-a.goals),scorers=statPlayers.filter(p=>p.goals>0);
const visiblePlayers=selectedPosition?statPlayers.filter(p=>p.position===selectedPosition):statPlayers;
const dateText=m=>{if(!m)return 'Por definir';const date=new Date(String(m.fecha||'')+'T12:00:00');const day=Number.isNaN(date.getTime())?'Fecha por definir':new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'numeric',month:'short'}).format(date);return `${day} · ${m.hora||'Hora por definir'}`};
document.querySelector('#app').className='';document.querySelector('#app').innerHTML = `
  <nav class="nav">
    <a href="#inicio" class="brand" aria-label="${esc(TEAM.name)} inicio">${Crest({ small: true })}<span>${teamDisplay()}</span></a>
    <button class="nav__toggle" aria-label="Abrir menú" aria-expanded="false">☰</button>
    <div class="nav__links"><a href="#plantilla">Plantilla</a><a href="#goleadoras">Goleadoras</a><a href="#club">El club</a><a href="${window.TeamContext?.adminUrl || './admin/login.html'}">Acceso</a><a class="live-link" href="${(window.TeamContext?.adminUrl || './admin/login.html') + '&next=match'}"><i></i> Acceso modo partido</a></div>
  </nav>

  <main>
    <section class="hero" id="inicio">
      <div class="hero-paws" aria-hidden="true">${Array.from({length:18},(_,i)=>`<img class="hero-paw hero-paw--${i+1}" src="${esc(TEAM.paw)}" alt="">`).join('')}</div>
      <div class="hero__crest">${Crest()}</div>
      <div class="hero__copy"><span class="eyebrow">${esc(COPY.heroEyebrow||'Orgullo · Fuerza · Comunidad')}</span><h1>${esc(COPY.heroTitle1||teamNameUpper())}<br><em>${esc(COPY.heroTitle2||TEAM.suffix||'')}</em></h1><p>${COPY.heroTagline||'Una misma cancha.<br>Una sola manada.'}</p><a class="button button--gold" href="#plantilla">Ver plantilla <span>↗</span></a></div>
    </section>

    <section class="rounds section" id="jornadas"><header class="rounds__head"><div><span class="eyebrow dark">${esc(COPY.calendarEyebrow||'Calendario oficial')}</span><h2>${esc(COPY.calendarTitle1||'HUELLAS EN')} <em>${esc(COPY.calendarTitle2||'LA CANCHA')}</em></h2></div><p>${COPY.calendarDesc||'Próximo desafío y resultado más reciente<br>sin perder de vista la temporada.'}</p></header><div class="rounds__grid">
      <article class="round-card round-card--next"><div class="round-card__top"><span>${nextEntry?.estado==='jugando'?'En vivo':'Próxima jornada'}</span><b>J${nextEntry?.jornada||'—'}</b></div>${nextEntry?.estado==='descanso'?`<div class="round-card__rest"><strong>DESCANSO</strong><p>${dateText(nextEntry)}</p></div>`:nextEntry?`<div class="round-card__teams"><strong>${teamNameUpper()}</strong><em>VS</em><strong>${(nextEntry.rival||'RIVAL').toUpperCase()}</strong></div><div class="round-card__details"><span>${dateText(nextEntry)}</span><span>${nextEntry.lugar||'Lugar por definir'}</span></div>`:'<div class="round-card__empty">Sin jornadas programadas</div>'}</article>
      <article class="round-card round-card--result"><div class="round-card__top"><span>Último resultado</span><b>J${last?.jornada||'—'}</b></div>${last?`<div class="round-card__teams"><strong>${teamNameUpper()}</strong><em class="round-score">${last.golesXolitas} — ${last.golesRival}</em><strong>${(last.rival||'RIVAL').toUpperCase()}</strong></div><div class="round-card__details"><span>${last.torneo||'Liga'}</span><span>${dateText(last)}</span></div>`:'<div class="round-card__empty">Aún sin resultados</div>'}</article>
    </div><button type="button" class="rounds__all" id="open-rounds">Ver todas las jornadas <span>→</span></button></section>
    <dialog class="journeys-modal" id="journeys-modal"><header><div><span class="eyebrow">${esc(TEAM.season||'Temporada 2026')}</span><h2>JORNADAS Y RESULTADOS</h2></div><button type="button" data-rounds-close aria-label="Cerrar">×</button></header><div class="journeys-modal__list">${[...matches].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).map(journeyRow).join('')}</div></dialog>

    ${standings.length?`<section class="standings section ${teamFirst?'standings--xolitas-first':''}" id="clasificacion">${teamFirst?`<div class="standings-celebration" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="--x:${3+i*5.4}%;--delay:${i*-.23}s;--rotation:${i*19}deg"></i>`).join('')}</div>`:''}<header class="standings__head"><div><span class="eyebrow dark">V Torneo Femenil Chuburná Inn</span><h2>TABLA DE <em>POSICIONES</em></h2></div><div class="standings__status">${teamFirst?`<strong>🌟 ¡${teamNameUpper()} LIDERA!</strong><span>El equipo está en primer lugar</span>`:'<strong>CLASIFICACIÓN</strong><span>Actualización oficial del torneo</span>'}</div></header><div class="standings__scroll"><table><thead><tr><th>Pos</th><th>Equipo</th><th>Pts</th><th>J</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Dif</th><th>%</th><th>PE</th></tr></thead><tbody>${standings.map((row,index)=>`<tr class="${String(row.equipo||'').toLowerCase().includes(String(TEAM.shortName||TEAM.name).toLowerCase())?'is-xolitas':''}"><td><b>${index+1}</b></td><td><div class="standing-team">${row.logo?`<img src="${escapePublic(row.logo)}" alt="">`:String(row.equipo||'').toLowerCase().includes(String(TEAM.shortName||TEAM.name).toLowerCase())?`<img src="${esc(TEAM.logo)}" alt="">`:`<span>${escapePublic(row.equipo.slice(0,2).toUpperCase())}</span>`}<strong>${escapePublic(row.equipo)}</strong></div></td><td><b>${row.pts}</b></td><td>${row.j}</td><td>${row.g}</td><td>${row.e}</td><td>${row.p}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dif>0?'+':''}${row.dif}</td><td>${row.porcentaje}</td><td>${row.pe}</td></tr>`).join('')}</tbody></table></div><p class="standings__legend">Pts: puntos · J: jugados · G: ganados · E: empatados · P: perdidos · GF/GC: goles · PE: puntos extra</p></section>`:''}

    <section class="team section" id="plantilla">
      <header class="section__head"><div><span class="eyebrow dark">${esc(TEAM.season||'Temporada 2026')}</span><h2>${esc(COPY.rosterTitle1||'NUESTRA')} <em>${esc(COPY.rosterTitle2||'MANADA')}</em></h2></div><p>${COPY.rosterDesc||'Talento, carácter y corazón.<br>Conoce a quienes defienden nuestros colores.'}</p></header>
      <div class="position-filters" role="group" aria-label="Filtrar jugadoras por posición">${[['','Todas'],['Portera','Porteras'],['Defensa','Defensas'],['Mediocampista','Mediocampistas'],['Delantera','Delanteras']].map(([value,label])=>`<button type="button" data-position="${value}" class="${selectedPosition===value?'is-active':''}">${label}<span>${value?statPlayers.filter(p=>p.position===value).length:statPlayers.length}</span></button>`).join('')}</div>
      <div class="players players--all">${visiblePlayers.length?visiblePlayers.map((p, i) => playerCard(p,i,true)).join(''):'<p class="public-empty">No hay jugadoras en esta posición.</p>'}</div>
    </section>
    <dialog class="profile-modal" id="profile-modal"><button type="button" data-profile-close aria-label="Cerrar">×</button><div id="profile-content"></div></dialog>

    <section class="scorers section" id="goleadoras">
      <div class="scorers__intro"><span class="eyebrow">${esc(COPY.scorersEyebrow||'El gol tiene nombre')}</span><h2>${esc(COPY.scorersTitle1||'LAS QUE')}<br><em>${esc(COPY.scorersTitle2||'DEFINEN.')}</em></h2><p>${COPY.scorersDesc||'Precisión, instinto y una ambición que no negocia.'}</p><label class="league-filter">Estadísticas de<select id="public-league"><option value="">Todas las ligas</option>${leagues.map(l=>`<option value="${l.id}" ${String(l.id)===String(selectedLeagueId)?'selected':''}>${l.nombre}</option>`).join('')}</select></label><div class="season">${selectedLeague?.nombre||'Histórico general'}</div></div>
      <div class="ranking">
        ${scorers.length?scorers.slice(0,3).map((p,i) => {
          const imageStyle=p.photoUrl?`--player-image:url('${esc(String(p.photoUrl).replace(/'/g,'%27'))}');--player-size:cover;--player-position:center top`:'';
          return `<article class="rank rank--${i+1}"><span class="rank__place">0${i+1}</span><div class="rank__avatar" style="--photo:${p.photoIndex??0};${imageStyle}"></div><div><small>${p.position}</small><h3>${p.name} ${p.last}</h3></div><strong>${p.goals}<small>GOLES</small></strong>${i===0?'<span class="rank__star">✦</span>':''}</article>`;
        }).join(''):'<p class="public-empty public-empty--light">No hay goles registrados en esta liga.</p>'}
      </div>
    </section>

    <section class="statement" id="club"><span>${esc(COPY.clubLead||'NO SOLO JUGAMOS.')}</span><h2>${esc(COPY.clubTitle1||'DEJAMOS')} <em>${esc(COPY.clubTitle2||'HUELLA.')}</em></h2><div class="paw">✦</div></section>
    ${sponsors.length?`<section class="sponsors section" id="patrocinadores"><div class="sponsors__glow" aria-hidden="true">✦</div><header class="sponsors__head"><div><span class="eyebrow">Patrocinadores oficiales</span><h2>${esc(COPY.sponsorsTitle1||'IMPULSAN NUESTRA')} <em>${esc(COPY.sponsorsTitle2||'MANADA')}</em></h2></div><p>${COPY.sponsorsDesc||'Su confianza nos acompaña en cada jornada.<br>Juntos dejamos huella dentro y fuera de la cancha.'}</p></header><div class="sponsors__grid">${sponsors.map(s=>`${s.sitio?`<a href="${escapePublic(s.sitio)}" target="_blank" rel="noopener noreferrer"`:'<div'} class="sponsor-card"><small>Patrocinador oficial</small><img src="${escapePublic(s.logo)}" alt="${escapePublic(s.nombre)}"><span>${escapePublic(s.nombre)}</span>${s.sitio?'</a>':'</div>'}`).join('')}</div><div class="sponsors__thanks">${esc(COPY.sponsorsThanks||`Gracias por creer en ${TEAM.name}.`)} <span>✦</span></div></section>`:''}

    <section class="next section"><div><span class="eyebrow dark">${next?.estado==='jugando'?'Partido en vivo':'Próximo encuentro'}</span><p class="date">${next?dateText(next).toUpperCase():'SIN PARTIDOS PROGRAMADOS'}</p></div>${next?`<div class="versus"><div>${Crest({small:true})}<strong>${teamNameUpper()}</strong></div><span>VS</span><img class="rival-logo" src="${next.logoRival||DEFAULT_RIVAL}" alt="Escudo de ${next.rival||'rival'}" onerror="this.onerror=null;this.src='${DEFAULT_RIVAL}'"><div><strong>${(next.rival||'RIVAL').toUpperCase()}</strong><small>${next.estado==='jugando'?'EN VIVO':'F.C.'}</small></div></div><a class="button button--purple" href="${(window.TeamContext?.adminUrl || './admin/login.html') + '&next=match&matchId=' + encodeURIComponent(next.id)}">${next.estado==='jugando'?'Continuar':'Acceder al'} modo partido <span>↗</span></a>`:'<div class="no-next-match">No hay encuentros registrados por el momento.</div>'}</section>
  </main>

  <footer><div class="brand">${Crest({small:true})}<span>${teamDisplay()}</span></div><p>${COPY.footer||'Hechas de historia.<br>Jugamos el presente.'}</p><div><a href="#">Instagram</a><a href="#">Facebook</a><a href="#">Contacto</a></div><small>© ${new Date().getFullYear()} ${esc(TEAM.name)}</small></footer>

  <dialog class="match-modal">
    <button class="match-close" aria-label="Cerrar">×</button><div class="live"><i></i> EN VIVO</div>
    <div class="score-teams"><div>${Crest({small:true})}<strong>${teamNameUpper()}</strong></div><span class="score"><b id="home-score">2</b><em>—</em><b>1</b></span><div class="rival-badge">P</div><strong>PANTERAS</strong></div>
    <div class="clock">38:24</div><button class="goal-button">⚽ &nbsp; GOL ${teamNameUpper()}</button><p class="match-hint">Toca para registrar un gol</p>
    <div class="goal-flash"><span>✦</span><small>¡GOOOOOOL!</small><h2>JESSICA</h2><b>#10</b></div>
  </dialog>
`;

const modal = document.querySelector('.match-modal');
document.querySelectorAll('[data-open-match]').forEach(b => b.addEventListener('click', () => modal.showModal()));
document.querySelector('.match-close').addEventListener('click', () => modal.close());
document.querySelector('.goal-button').addEventListener('click', () => {
  const score = document.querySelector('#home-score'); score.textContent = Number(score.textContent) + 1;
  modal.classList.remove('is-goal'); void modal.offsetWidth; modal.classList.add('is-goal');
  setTimeout(() => modal.classList.remove('is-goal'), 2100);
});
const toggle = document.querySelector('.nav__toggle');
toggle.addEventListener('click', () => { const open = document.body.classList.toggle('menu-open'); toggle.setAttribute('aria-expanded', open); });
document.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
document.querySelector('#public-league')?.addEventListener('change',e=>{selectedLeagueId=e.target.value;renderSite();document.querySelector('#goleadoras')?.scrollIntoView()});
const profileModal=document.querySelector('#profile-modal');
document.querySelectorAll('[data-profile-close]').forEach(button=>button.addEventListener('click',()=>profileModal.close()));
document.querySelectorAll('[data-player-index]').forEach(card=>card.addEventListener('click',()=>openPlayerProfile(Number(card.dataset.playerIndex))));
document.querySelectorAll('[data-position]').forEach(button=>button.addEventListener('click',()=>{selectedPosition=button.dataset.position;renderSite();document.querySelector('#plantilla')?.scrollIntoView({behavior:'smooth'})}));
const journeysModal=document.querySelector('#journeys-modal');
document.querySelector('#open-rounds')?.addEventListener('click',()=>journeysModal.showModal());
document.querySelectorAll('[data-rounds-close]').forEach(button=>button.addEventListener('click',()=>journeysModal.close()));
applyModuleVisibility();
}
function applyModuleVisibility(){const m=window.TeamContext?.settings?.modules||{};const map={calendar:'#jornadas',standings:'#clasificacion',roster:'#plantilla',stats:'#goleadoras',club:'#club',sponsors:'#patrocinadores',next_match:'.next'};for(const [k,sel] of Object.entries(map)){if(m[k]===false)document.querySelector(sel)?.remove()}if(m.live_match===false)document.querySelectorAll('.live-link,[href*="next=match"]').forEach(el=>el.remove())}
function journeyRow(match){const isRest=match.estado==='descanso'||match.tipo==='descanso',isFinal=match.estado==='finalizado',isLive=match.estado==='jugando';const status=isRest?'DESCANSO':isFinal?'FINAL':isLive?'EN VIVO':'PRÓXIMO';return `<article class="journey-row journey-row--${match.estado||'programado'}"><div class="journey-row__number"><small>JORNADA</small><b>${match.jornada||'—'}</b></div><div class="journey-row__date"><strong>${dateForJourney(match.fecha)}</strong><span>${match.hora||'Hora por definir'}</span></div>${isRest?'<div class="journey-row__rest">DESCANSO</div>':`<div class="journey-row__match"><strong>${teamNameUpper()}</strong>${isFinal||isLive?`<b>${match.golesXolitas} — ${match.golesRival}</b>`:'<b>VS</b>'}<strong>${escapePublic((match.rival||'Rival').toUpperCase())}</strong></div>`}<span class="journey-row__status">${status}</span></article>`}
function dateForJourney(value){if(!value)return 'Fecha por definir';const date=new Date(String(value)+'T12:00:00');return Number.isNaN(date.getTime())?'Fecha por definir':new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(date)}
function playerCard(p,index,compact){const imageStyle=p.photoUrl?`--player-image:url('${String(p.photoUrl).replace(/'/g,'%27')}');--player-size:cover`:'';return `<button type="button" class="player ${compact?'player--compact':'player--large'}" data-player-index="${p.sourceIndex}" style="--photo:${p.photoIndex};${imageStyle}"><div class="player__photo"></div><div class="player__shade"></div><span class="player__number">${String(p.number).padStart(2,'0')}</span><div class="player__info"><small>${p.position}</small><h3>${p.name}<br><b>${p.last}</b></h3><p><span>⚽</span> ${p.goals} goles</p></div></button>`}
function openPlayerProfile(index){const p=players[index];if(!p)return;const imageStyle=p.photoUrl?`--player-image:url('${String(p.photoUrl).replace(/'/g,'%27')}');--player-size:cover`:'';const presentation=p.notes?.trim()||`${p.name} ${p.last} forma parte de ${TEAM.name} como ${String(p.position).toLowerCase()}. Su compromiso y trabajo en equipo representan la identidad de nuestro equipo.`;document.querySelector('#profile-content').innerHTML=`<div class="profile-photo" style="--photo:${p.photoIndex};${imageStyle}"></div><div class="profile-copy"><span class="profile-number">#${p.number}</span><small>${p.position}</small><h2>${p.name}<br><em>${p.last}</em></h2><p>${escapePublic(presentation)}</p><div class="profile-stats"><div><b>${p.matches}</b><span>Partidos</span></div><div><b>${p.goals}</b><span>Goles</span></div><div><b>${p.matches?((p.goals/p.matches).toFixed(2)):'0.00'}</b><span>Promedio</span></div></div></div>`;document.querySelector('#roster-modal')?.close();document.querySelector('#profile-modal').showModal()}
function escapePublic(value){const span=document.createElement('span');span.textContent=value;return span.innerHTML}
function hydrateSite(){refreshTeamContext();players=window.Xolitas.playersService.all().filter(p=>p.activa).map((p,i)=>({name:p.nombre,last:p.apellido,number:p.numero,position:p.posicion,goals:+p.goles||0,matches:+p.partidos||0,goalsByLeague:p.golesPorLiga||{},photoUrl:p.foto||'',photoIndex:p.fotoIndex??i%4,notes:p.notas||'',sourceIndex:i})).sort((a,b)=>b.goals-a.goals).map((p,i)=>({...p,sourceIndex:i}));renderSite()}
// Espera la resolución del tenant y los datos antes del primer render real.
window.Xolitas.ready.then(hydrateSite).catch(err=>{const app=document.querySelector('#app');if(app){app.className='';app.innerHTML=`<main style="padding:40px;font-family:DM Sans,sans-serif"><h1>No se pudo cargar el equipo</h1><p>${escapePublic(err.message)}</p></main>`}});
window.addEventListener('xolitas:realtime',hydrateSite);
