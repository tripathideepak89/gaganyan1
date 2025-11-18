
import { createClient } from '@supabase/supabase-js';

// Using the project URL provided
const supabaseUrl = 'https://izzopcectovmtopdqrgu.supabase.co';

// Helper to safely access environment variables in different environments (Vite, Next.js, standard)
// This handles cases where process.env might not be available in the browser
const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  // Check for import.meta.env (Vite)
  // @ts-ignore - Ignoring TS error for import.meta if not configured in tsconfig
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key] as string;
  }
  return '';
};

// Try to find the key in various common environment variable names
const supabaseKey = 
  getEnvVar('SUPABASE_ANON_KEY') || 
  getEnvVar('VITE_SUPABASE_ANON_KEY') || 
  getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 
  '';

if (!supabaseKey) {
  console.warn('Supabase Anon Key is missing. Airport autocomplete will not work. Please set SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
