import { createClient } from '@supabase/supabase-js';

// Authorized public project configuration
export const DEFAULT_SUPABASE_URL = 'https://aburknnkixeeqpvsyofc.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_nQu4lm4w3_Zq6a-18FvlsQ_johbNzzx';

// Allow optional environment overrides for future hosting environments
export const SUPABASE_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

// Central Supabase client configured exclusively with public publishable key
// Handles session persistence, auto-refresh of JWT tokens, and URL recovery detection
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'tecniflow_supabase_auth',
  },
  global: {
    fetch: (...args) => globalThis.fetch(...args),
  },
});
