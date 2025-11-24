
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

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

    console.error('Supabase Anon Key is missing. Auth and DB features will not work.');
    return null;
};

export const signInWithEmail = async (email: string, password: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase client not initialized");
    return supabase.auth.signInWithPassword({ email, password });
};

export const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase client not initialized");
    
    // Determine the URL to redirect to after email confirmation.
    // Priority:
    // 1. Explicit VITE_SITE_URL environment variable (useful for production overrides)
    // 2. Current window origin (browser)
    // 3. Fallback to localhost
    let redirectTo = 'http://localhost:3000';
    
    const envSiteUrl = getEnvVar('VITE_SITE_URL');
    if (envSiteUrl) {
        redirectTo = envSiteUrl;
    } else if (typeof window !== 'undefined') {
        redirectTo = window.location.origin;
    }

    return supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
            emailRedirectTo: redirectTo,
        }
    });
};

export const signOut = async () => {
    const supabase = await getSupabase();
    if (!supabase) return;
    return supabase.auth.signOut();
};

export const getCurrentUser = async (): Promise<User | null> => {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};