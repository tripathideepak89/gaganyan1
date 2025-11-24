
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

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

// --- DATABASE CACHING HELPERS (Using native fetch to avoid @supabase/supabase-js dependency in Worker) ---

async function getCachedResponse(supabaseUrl: string, supabaseKey: string, key: string): Promise<any | null> {
  try {
    const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
    // Supabase REST: GET /rest/v1/api_cache?key=eq.KEY&select=response,expires_at
    const url = `${baseUrl}/rest/v1/api_cache?key=eq.${encodeURIComponent(key)}&select=response,expires_at&limit=1`;
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
        if (response.status !== 404 && response.status !== 406) {
             console.warn(`[DB Cache Read Fail] Status: ${response.status} for key ${key}`);
        }
        return null;
    }
    const data = await response.json(); // Type: any[]

    if (Array.isArray(data) && data.length > 0) {
       const entry = data[0];
       if (new Date(entry.expires_at) > new Date()) {
           console.log(`[DB Cache Hit] ${key}`);
           return entry.response;
       } else {
           console.log(`[DB Cache Expired] ${key}`);
       }
    }
    return null;
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
}

async function setCachedResponse(supabaseUrl: string, supabaseKey: string, key: string, response: any, ttlSeconds: number) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const body = JSON.stringify({ key, response, expires_at: expiresAt });
    
    const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
    
    // Supabase REST: POST /rest/v1/api_cache with upsert behavior via resolution=merge-duplicates
    const res = await fetch(`${baseUrl}/rest/v1/api_cache`, {
        method: 'POST',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`[Cache Write Error] Key: ${key}, Status: ${res.status} ${res.statusText}`);
        console.error(`[Cache Write Error Details]: ${text}`);
        
        if (res.status === 401 || res.status === 403) {
            console.warn("Permission Denied: Your Supabase RLS policy likely prevents this write. Ensure you are using SUPABASE_SERVICE_ROLE_KEY in your environment variables to bypass RLS, or update the 'api_cache' table policy to allow inserts from the 'anon' role.");
        }
    } else {
        console.log(`[Cache Write Success] Key: ${key}`);
    }
  } catch (err) {
    console.error('[Cache Write Exception]', err);
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

  // Supabase Configuration for Backend Ops
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  const useCache = !!(env.SUPABASE_URL && supabaseKey);
  
  // Debug status for X-Cache-Status header
  let cacheDebugStatus = useCache ? 'MISS' : 'DISABLED';

  if (!env.SUPABASE_URL) {
      console.warn("Caching disabled: SUPABASE_URL missing in environment.");
  }
  if (env.SUPABASE_URL && !supabaseKey) {
      console.warn("Caching disabled: Supabase Keys (SERVICE_ROLE or ANON) missing in environment.");
  }

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
  
  // 1. Read request body if needed (for POST caching and upstream forwarding)
  let requestBody: string | null = null;
  if (request.method === 'POST' || request.method === 'PUT') {
      try {
          requestBody = await request.text();
      } catch (e) {
          console.error("Failed to read request body", e);
      }
  }

  // 2. Generate Cache Key
  let cacheKey = '';
  let ttl = 0;
  
  const isGet = request.method === 'GET';
  const isPost = request.method === 'POST';

  // Logic to determine cache key based on API path and params/body
  // Reference Data (e.g. City Codes)
  if (isGet && actualPath.includes('reference-data/locations')) {
      cacheKey = `amadeus:ref:${url.searchParams.toString()}`;
      ttl = 60 * 60 * 24 * 7; // 7 days
  } 
  // Flight Search (Amadeus uses GET, Duffel uses POST)
  else if (actualPath.includes('flight-offers') || actualPath.includes('offer_requests')) {
      if (isGet) {
           cacheKey = `amadeus:flights:${url.searchParams.toString()}`;
           ttl = 60 * 30; // 30 mins
      } else if (isPost && requestBody) {
           const hash = await hashString(requestBody);
           cacheKey = `${apiProvider}:flights:${hash}`;
           ttl = 60 * 30; // 30 mins
      }
  } 
  // Hotel Search (Amadeus GET, Duffel POST)
  else if (actualPath.includes('hotel-offers') || actualPath.includes('hotels/search') || actualPath.includes('stays/search')) {
      if (isGet) {
          cacheKey = `amadeus:hotels:${url.searchParams.toString()}`;
          ttl = 60 * 60; // 1 hour
      } else if (isPost && requestBody) {
          const hash = await hashString(requestBody);
          cacheKey = `${apiProvider}:hotels:${hash}`;
          ttl = 60 * 60; // 1 hour
      }
  }

  if (cacheKey) {
      console.log(`[Cache Key Generated] ${cacheKey}`);
  }

  // 3. Try Read Cache
  if (useCache && cacheKey) {
      const cachedData = await getCachedResponse(env.SUPABASE_URL, supabaseKey, cacheKey);
      if (cachedData) {
          return new Response(JSON.stringify(cachedData), {
              status: 200,
              headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'X-Cache-Source': 'Supabase-DB',
                  'X-Cache-Status': 'HIT',
                  'X-Cache-Key': cacheKey
              }
          });
      }
  }

  // 4. Fetch from Upstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('host');
  requestHeaders.delete('referer');
  // IMPORTANT: Remove Accept-Encoding to prevent upstream from sending compressed data (gzip/br).
  // The worker needs plain text (or auto-handled text) to clone().json() successfully for caching.
  requestHeaders.delete('accept-encoding');

  let targetUrl: string;
  let apiRequestOptions: RequestInit = {
    method: request.method,
    headers: requestHeaders,
    body: requestBody ? requestBody : undefined,
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
      (apiRequestOptions.headers as Headers).set('Duffel-Version', 'beta');
    } else {
      return new Response('Invalid API provider.', { status: 400 });
    }

    const apiResponse = await fetch(targetUrl, apiRequestOptions);
    
    // Process response for return and caching
    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    
    // Set debug headers
    if (cacheKey) responseHeaders.set('X-Cache-Key', cacheKey);

    // 5. Write Cache (Async)
    // Only cache successful JSON responses with a valid TTL
    if (useCache && cacheKey && apiResponse.ok && ttl > 0) {
        // Clone the response to read it for caching while still returning original body stream
        const responseClone = apiResponse.clone();
        
        // Use waitUntil to process caching in background without delaying response
        waitUntil((async () => {
            try {
                // Must parse JSON to store structured data in JSONB column
                const responseData = await responseClone.json();
                console.log(`[Cache Trigger] Attempting to cache ${cacheKey}`);
                await setCachedResponse(env.SUPABASE_URL, supabaseKey, cacheKey, responseData, ttl);
            } catch (e) {
                console.warn(`[Cache Skip] Failed to parse response JSON for ${cacheKey}:`, e);
            }
        })());
        
        responseHeaders.set('X-Cache-Status', 'STORE');
    } else {
        if (!useCache) {
             responseHeaders.set('X-Cache-Status', 'DISABLED');
        } else if (!cacheKey) {
             responseHeaders.set('X-Cache-Status', 'NO_KEY');
        } else if (!apiResponse.ok) {
             responseHeaders.set('X-Cache-Status', `UPSTREAM_${apiResponse.status}`);
        } else {
             responseHeaders.set('X-Cache-Status', 'MISS');
        }
    }

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
