import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.PROD || import.meta.env.DEV
  ? `${window.location.origin}/supabase-api/`
  : import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!rawUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseUrl = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const SUPABASE_URL = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
