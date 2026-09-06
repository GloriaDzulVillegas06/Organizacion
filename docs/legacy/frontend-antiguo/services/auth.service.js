import { store } from './store.service.js';
const demoUsers={admin:{name:'Gloria',role:'admin'},captura:{name:'Capturista',role:'capturista'},consulta:{name:'Consulta',role:'consulta'}};
export const authService={
  login(user,password){if(!demoUsers[user]||!password)throw new Error('Usuario o contraseña incorrectos');return store.set('session',{...demoUsers[user],user})},
  logout(){store.remove('session')}, session(){return store.get('session',null)},
  require(redirect=true){const s=this.session();if(!s&&redirect)location.href='./login.html';return s},
  can(permission){const role=this.session()?.role;const map={admin:['managePlayers','manageMatches','capture','settings'],capturista:['capture'],consulta:[]};return map[role]?.includes(permission)??false}
};
