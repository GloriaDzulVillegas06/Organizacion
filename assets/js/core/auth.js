import {CONFIG,supabase,configured} from './supabase.js';
const DK='sports_demo_auth';
export async function login(email,password){if(CONFIG.DEMO_MODE||!configured){if(!email||!password)throw new Error('Escribe correo y contraseña.');const s={user:{id:'demo-super',email},platformRole:'super_admin'};sessionStorage.setItem(DK,JSON.stringify(s));return s}const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;return hydrate(data.session)}
export async function current(){if(CONFIG.DEMO_MODE||!configured)return JSON.parse(sessionStorage.getItem(DK)||'null');const {data}=await supabase.auth.getSession();return data.session?hydrate(data.session):null}
async function hydrate(session){const {data:platform}=await supabase.from('platform_users').select('role').eq('user_id',session.user.id).maybeSingle();return{...session,platformRole:platform?.role||null}}
export async function logout(){if(CONFIG.DEMO_MODE||!configured)sessionStorage.removeItem(DK);else await supabase.auth.signOut()}
export async function requireAuth(){const s=await current();if(!s){location.href='./login.html';return null}return s}
