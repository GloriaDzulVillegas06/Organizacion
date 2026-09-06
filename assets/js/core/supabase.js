export const CONFIG=window.SPORTS_CONFIG||{};
export const configured=Boolean(CONFIG.SUPABASE_URL&&CONFIG.SUPABASE_PUBLISHABLE_KEY&&!CONFIG.SUPABASE_URL.includes('PEGA_AQUI'));
export const supabase=configured?window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export function requireConfigured(){if(!configured)throw new Error('Supabase todavía no está configurado. Revisa assets/js/config.js');return supabase;}
