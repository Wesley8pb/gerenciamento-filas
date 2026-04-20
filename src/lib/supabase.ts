import { createClient } from '@supabase/supabase-js';

// No ambiente do TRE/PB, o domínio *.supabase.co é bloqueado. 
// Usamos um Proxy Reverso no Netlify (/supabase-api) para contornar isso.
// IMPORTANTE: A URL deve terminar com '/' para que o Supabase Client 
// não remova o segmento '/supabase-api' ao construir as rotas internas (auth/rest).
const rawUrl = import.meta.env.PROD 
  ? `${window.location.origin}/supabase-api/` 
  : import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!rawUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Garantimos que a URL para o cliente sempre termine com barra
const supabaseUrl = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Exportamos a URL sem a barra final para os services que concatenam caminhos manualmente
// (evitando duplicar barras ex: .../supabase-api//functions)
export const SUPABASE_URL = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;