import { createClient } from '@supabase/supabase-js';

// No ambiente do TRE/PB, o domínio *.supabase.co é bloqueado. 
// Usamos um Proxy Reverso no Netlify (/supabase-api) para contornar isso.
// O Supabase Client exige uma URL absoluta (começando com http/https).
const supabaseUrl = import.meta.env.PROD 
  ? `${window.location.origin}/supabase-api` 
  : import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Exportamos a URL processada para que os services (Edge Functions via fetch) 
// também utilizem o proxy em produção.
export { supabaseUrl as SUPABASE_URL };