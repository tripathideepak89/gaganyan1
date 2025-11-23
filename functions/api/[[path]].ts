
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fix for KVNamespace type not being found
interface KVNamespace {
  put(key: string, value: string): Promise<void>;
}

interface Env {
  API_KEY: string;
  AMADEUS_API_KEY: string;
  AMADEUS_API_SECRET: string;
  DUFFEL_API_KEY: string;
  LOG_DB: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string; // Preferred for backend operations to bypass RLS on cache
  SUPABASE_JWT_SECRET: string;
}

// A simple in-memory cache for the Amadeus token within the worker instance
let amadeusTokenCache = {
  value: null as string | null,
  expires: 0,
};

async function getAmadeusToken(apiKey: string, apiSecret: string): Promise<string> {
  if (amadeusTokenCache.value && amadeusTokenCache.expires > Date.now()) {
    return amadeusTokenCache.value;
  }

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus API credentials are not configured in environment.');
  }

  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch Amadeus token:", errorText);
    throw new Error('Amadeus authentication failed.');
  }

  const data: { access_token: string; expires_in: number } = await response.json();
  amadeusTokenCache = {
    value: data.access_token,
    expires: Date.now() + (data.expires_in * 1000) - 30000, // 30s buffer
  };

  return amadeusTokenCache.value;
}

// Helper to verify Supabase JWT signature using HMAC SHA-256
async function verifySupabaseToken(token: string, secret: string): Promise<any | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    
    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBin = atob(signatureStr);
    const signatureBytes = new Uint8Array(signatureBin.length);
    for (let i = 0; i < signatureBin.length; i++) signatureBytes[i] = signatureBin.charCodeAt(i);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      dataToVerify
    );

    if (!isValid) return null;

    const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadStr);
  } catch (e) {
    console.error("JWT Verification failed:", e);
    return null;
  }
}

// --- DATABASE CACHING HELPERS ---

async function getCachedResponse(supabase: SupabaseClient, key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('response, expires_at')
      .eq('key', key)
      .single();

    if (error || !data) return null;

    if (new Date(data.expires_at) > new Date()) {
      console.log(`[DB Cache Hit] ${key}`);
      return data.response;
    } else {
       // Clean up expired (async)
       console.log(`[DB Cache Expired] ${key}`);
       return null;
    }
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
}

async function setCachedResponse(supabase: SupabaseClient, key: string, response: any, ttlSeconds: number) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabase
      .from('api_cache')
      .upsert({ key, response, expires_at: expiresAt }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Cache write error:', err);
  }
}

// --------------------------------

type CFPagesFunction = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (promise: Promise<any>) => void;
}) => Promise<Response>;

export const onRequest: CFPagesFunction = async (context) => {
  const { request, env, params, waitUntil } = context;
  const url = new URL(request.url);
  const pathSegments = params.path as string[];
  const apiProvider = pathSegments[0];

  // Initialize Supabase Client for Backend Operations
  // Use Service Role Key if available for backend-to-backend cache access, otherwise Anon Key
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const supabase = env.SUPABASE_URL && supabaseKey 
    ? createClient(env.SUPABASE_URL, supabaseKey) 
    : null;

  // Handle logging requests
  if (apiProvider === 'log' && pathSegments[1] === 'search' && request.method === 'POST') {
    try {
      if (!env.LOG_DB) {
        return new Response('Log skipped (KV binding missing).', { status: 200 });
      }

      const authHeader = request.headers.get('Authorization');
      let userId = 'anonymous';
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          if (env.SUPABASE_JWT_SECRET) {
              const payload = await verifySupabaseToken(token, env.SUPABASE_JWT_SECRET);
              if (payload && payload.sub) {
                  userId = payload.sub;
                  if (payload.exp && payload.exp < Date.now() / 1000) {
                      return new Response('Token expired', { status: 401 });
                  }
              }
          }
      }

      const { user, query } = await request.json() as { user: { email: string }, query: string };
      if (!query) return new Response('Missing query.', { status: 400 });
      
      const key = `search:${userId}:${new Date().toISOString()}`;
      const logEntry = JSON.stringify({
          userEmail: user?.email || 'unknown',
          userId: userId,
          query,
          timestamp: new Date().toISOString()
      });

      waitUntil(env.LOG_DB.put(key, logEntry));
      return new Response('Log successful.', { status: 200 });
    } catch (error) {
      console.error('Logging error:', error);
      return new Response('Failed to log request.', { status: 500 });
    }
  }

  // Config endpoints
  if (apiProvider === 'get-key') {
    return new Response(JSON.stringify({ apiKey: env.API_KEY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (apiProvider === 'get-supabase-config') {
    return new Response(JSON.stringify({ supabaseKey: env.SUPABASE_ANON_KEY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- PROXY LOGIC WITH CACHING ---
  
  const actualPath = pathSegments.slice(1).join('/');
  
  // Determine if cacheable
  // We use the full URL search params as part of the key
  const isGetRequest = request.method === 'GET';
  const isPostSearch = request.method === 'POST' && (actualPath.includes('search') || actualPath.includes('offer_requests'));
  
  // Cache keys
  let cacheKey = '';
  let ttl = 0;

  // 1. Static Reference Data (City Codes, Locations) - Cache for 7 days
  if (isGetRequest && actualPath.includes('reference-data/locations')) {
      cacheKey = `amadeus:locations:${url.searchParams.toString()}`;
      ttl = 60 * 60 * 24 * 7; 
  }
  // 2. Flight Search - Cache for 30 minutes
  else if ((isGetRequest && actualPath.includes('shopping/flight-offers')) || (isPostSearch && actualPath.includes('air/offer_requests'))) {
      // For POST requests, we'd need to hash the body to make a key, 
      // but for now we'll focus on GET params for Amadeus.
      // Duffel uses POST, so we'll skip caching Duffel POSTs for simplicity in this V1 unless we read the body.
      if (isGetRequest) {
          cacheKey = `amadeus:flights:${url.searchParams.toString()}`;
          ttl = 60 * 30; 
      }
  }
  // 3. Hotel Search - Cache for 1 hour
  else if (actualPath.includes('shopping/hotel-offers') || actualPath.includes('hotels/search')) {
       if (isGetRequest) {
          cacheKey = `amadeus:hotels:${url.searchParams.toString()}`;
          ttl = 60 * 60;
       }
  }

  // TRY READ CACHE
  if (supabase && cacheKey) {
      const cachedData = await getCachedResponse(supabase, cacheKey);
      if (cachedData) {
          return new Response(JSON.stringify(cachedData), {
              status: 200,
              headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'X-Cache-Source': 'Supabase-DB'
              }
          });
      }
  }

  // --- ORIGIN FETCH ---

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('host');
  requestHeaders.delete('referer');

  let targetUrl: string;
  let apiRequestOptions: RequestInit = {
    method: request.method,
    headers: requestHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : undefined,
    redirect: 'follow',
  };

  try {
    if (apiProvider === 'amadeus') {
      const { AMADEUS_API_KEY, AMADEUS_API_SECRET } = env;
      const token = await getAmadeusToken(AMADEUS_API_KEY, AMADEUS_API_SECRET);
      const destinationUrl = new URL(actualPath, 'https://test.api.amadeus.com');
      destinationUrl.search = url.search;
      targetUrl = destinationUrl.toString();
      (apiRequestOptions.headers as Headers).set('Authorization', `Bearer ${token}`);
    } else if (apiProvider === 'duffel') {
      const { DUFFEL_API_KEY } = env;
      if (!DUFFEL_API_KEY) return new Response('Duffel API key not configured.', { status: 500 });
      const destinationUrl = new URL(actualPath, 'https://api.duffel.com');
      destinationUrl.search = url.search;
      targetUrl = destinationUrl.toString();
      (apiRequestOptions.headers as Headers).set('Authorization', `Bearer ${DUFFEL_API_KEY}`);
      const duffelVersion = actualPath.startsWith('stays/') ? 'beta' : 'v1';
      (apiRequestOptions.headers as Headers).set('Duffel-Version', duffelVersion);
    } else {
      return new Response('Invalid API provider.', { status: 400 });
    }

    const apiResponse = await fetch(targetUrl, apiRequestOptions);
    
    // Process response for return and caching
    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    // Clone data for caching
    const responseData = await apiResponse.clone().json().catch(() => null);

    // WRITE CACHE (Async)
    if (supabase && cacheKey && apiResponse.ok && responseData && ttl > 0) {
        waitUntil(setCachedResponse(supabase, cacheKey, responseData, ttl));
    }

    // Return original body
    return new Response(apiResponse.body, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`Proxy error for ${apiProvider}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
