import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Using the project URL provided
const supabaseUrl = 'https://izzopcectovmtopdqrgu.supabase.co';
let supabaseInstance: SupabaseClient | null = null;

// Helper to safely access environment variables in different environments
const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  // Check for import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key] as string;
  }
  return '';
};

export const getSupabase = async (): Promise<SupabaseClient | null> => {
    if (supabaseInstance) return supabaseInstance;

    // 1. Try to get the key from local environment variables first
    let key = 
        getEnvVar('SUPABASE_ANON_KEY') || 
        getEnvVar('VITE_SUPABASE_ANON_KEY') || 
        getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    // 2. If not found locally, try to fetch it from the backend (Cloudflare Worker)
    if (!key) {
        try {
            const response = await fetch('/api/get-supabase-config');
            if (response.ok) {
                const data = await response.json();
                key = data.supabaseKey;
            } else {
                console.warn('Failed to fetch Supabase config from backend:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching Supabase config from backend:', error);
        }
    }

    if (key) {
        supabaseInstance = createClient(supabaseUrl, key);
        return supabaseInstance;
    }

    console.error('Supabase Anon Key is missing. Airport autocomplete will not work.');
    return null;
};