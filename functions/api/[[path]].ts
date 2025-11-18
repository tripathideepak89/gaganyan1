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
  SUPABASE_ANON_KEY: string;
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

// Fix for PagesFunction generic type issue by renaming to avoid potential conflicts
type CFPagesFunction = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (promise: Promise<any>) => void;
}) => Promise<Response>;

// Fix: Make CFPagesFunction non-generic to resolve "Expected 0 type arguments" error.
export const onRequest: CFPagesFunction = async (context) => {
  const { request, env, params, waitUntil } = context;
  const url = new URL(request.url);
  const pathSegments = params.path as string[];
  const apiProvider = pathSegments[0];

  // Handle logging requests
  if (apiProvider === 'log' && pathSegments[1] === 'search' && request.method === 'POST') {
    try {
      if (!env.LOG_DB) {
        console.warn('LOG_DB (KV Namespace) is not configured. Skipping search logging.');
        return new Response('Log skipped (KV binding missing).', { status: 200 });
      }
      
      // Fix: The .json() method on Request does not accept a generic type argument. Cast the result instead.
      const { user, query } = await request.json() as { user: { email: string }, query: string };
      if (!user || !user.email || !query) {
        return new Response('Missing user email or query for logging.', { status: 400 });
      }
      const key = `${user.email}:${new Date().toISOString()}`;
      waitUntil(env.LOG_DB.put(key, query));
      return new Response('Log successful.', { status: 200 });
    } catch (error) {
      console.error('Logging error:', error);
      return new Response('Failed to log request.', { status: 500 });
    }
  }

  if (apiProvider === 'get-key') {
    const apiKey = env.API_KEY;
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API_KEY is not configured on the server.' }), {
        status: 500,
        headers: headers,
      });
    }
    return new Response(JSON.stringify({ apiKey }), {
      status: 200,
      headers: headers,
    });
  }

  if (apiProvider === 'get-supabase-config') {
    const supabaseKey = env.SUPABASE_ANON_KEY;
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };
    
    if (!supabaseKey) {
        return new Response(JSON.stringify({ error: 'SUPABASE_ANON_KEY is not configured on the server.' }), {
            status: 500,
            headers: headers,
        });
    }

    return new Response(JSON.stringify({ supabaseKey }), {
      status: 200,
      headers: headers,
    });
  }
  
  const actualPath = pathSegments.slice(1).join('/');
  const isLocationSearch = actualPath.includes('reference-data/locations');

  // Caching for location lookups
  // Fix for caches.default property not being found on CacheStorage type
  const cache = await caches.open('default');
  const cacheKey = new Request(url.toString(), request);
  if (isLocationSearch && request.method === 'GET') {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      console.log(`Cache HIT for: ${url.toString()}`);
      return cachedResponse;
    }
    console.log(`Cache MISS for: ${url.toString()}`);
  }

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
      if (!DUFFEL_API_KEY) {
        return new Response('Duffel API key not configured.', { status: 500 });
      }

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
    
    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    const responseToReturn = new Response(apiResponse.body, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: responseHeaders,
    });

    // Cache the response if it's a successful location search
    if (isLocationSearch && request.method === 'GET' && apiResponse.ok) {
      const responseToCache = new Response(responseToReturn.clone().body, responseToReturn);
      responseToCache.headers.set('Cache-Control', 's-maxage=86400'); // Cache for 1 day
      waitUntil(cache.put(cacheKey, responseToCache));
    }

    return responseToReturn;

  } catch (error) {
    console.error(`Proxy error for ${apiProvider}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
  }
};