export const $=(s,r=document)=>r.querySelector(s);export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const esc=(v='')=>{const e=document.createElement('div');e.textContent=String(v??'');return e.innerHTML};
export const slugify=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
export const fmtDate=v=>{if(!v)return 'Por definir';const d=new Date(v+'T12:00:00');return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(d)};
export const fmtMoney=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(v||0));
export function toast(msg,type='ok'){let h=$('#toast');if(!h){h=document.createElement('div');h.id='toast';h.className='toast-host';document.body.appendChild(h)}const n=document.createElement('div');n.className='toast '+type;n.textContent=msg;h.appendChild(n);setTimeout(()=>n.remove(),3500)}
export function queryTeam(){return new URLSearchParams(location.search).get('team')||sessionStorage.getItem('sports_team_slug')||''}
export function setTeamSlug(slug){sessionStorage.setItem('sports_team_slug',slug)}
export async function fileToDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
