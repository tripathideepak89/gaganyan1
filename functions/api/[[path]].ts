
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
  SUPABASE_JWT_SECRET: string; // Required for verifying JWTs on the backend
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
    
    // Convert signature from base64url to Uint8Array
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

    // Decode payload
    const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadStr);
  } catch (e) {
    console.error("JWT Verification failed:", e);
    return null;
  }
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

  // Hotel Aggregation Endpoint
  if (apiProvider === 'hotels' && pathSegments[1] === 'search') {
    const cityCode = url.searchParams.get('cityCode');
    const checkIn = url.searchParams.get('checkIn');
    const checkOut = url.searchParams.get('checkOut');
    const adults = parseInt(url.searchParams.get('adults') || '2', 10);
    const sortBy = url.searchParams.get('sortBy') || 'recommended';

    if (!cityCode || !checkIn || !checkOut) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: cityCode, checkIn, checkOut' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const { AMADEUS_API_KEY, AMADEUS_API_SECRET } = env;
      const token = await getAmadeusToken(AMADEUS_API_KEY, AMADEUS_API_SECRET);

      // 1. Get Hotels by City
      const listParams = new URLSearchParams({ cityCode, radius: '20', radiusUnit: 'KM' });
      const listUrl = `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?${listParams.toString()}`;
      
      const listResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!listResp.ok) {
         return new Response(await listResp.text(), { status: listResp.status });
      }
      
      const listData = await listResp.json();
      if (!listData.data || listData.data.length === 0) {
        return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Limit to top 50 hotels to avoid URI length issues
      const hotelIds = listData.data.slice(0, 50).map((h: any) => h.hotelId).join(',');

      // 2. Get Offers
      const offersParams = new URLSearchParams({
        hotelIds, checkInDate: checkIn, checkOutDate: checkOut, adults: adults.toString(),
        currency: 'USD', paymentPolicy: 'NONE', bestRateOnly: 'true', view: 'LIGHT'
      });
      const offersUrl = `https://test.api.amadeus.com/v3/shopping/hotel-offers?${offersParams.toString()}`;
      
      const offersResp = await fetch(offersUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!offersResp.ok) {
         return new Response(await offersResp.text(), { status: offersResp.status });
      }

      const offersData = await offersResp.json();
      let offers = offersData.data || [];
      
      // Filter valid offers
      offers = offers.filter((o: any) => o.available && o.hotel && o.offers?.[0]?.price);

      // Map to internal format
      let mappedOffers = offers.map((offer: any) => {
        const price = parseFloat(offer.offers[0].price.total);
        const rating = offer.hotel.rating ? parseInt(offer.hotel.rating, 10) : 0;
        return {
          hotelId: offer.hotel.hotelId,
          name: offer.hotel.name,
          rating,
          address: {
            lines: offer.hotel.address?.lines || [],
            cityName: offer.hotel.address?.cityName || '',
            postalCode: offer.hotel.address?.postalCode || '',
            countryCode: offer.hotel.address?.countryCode || '',
          },
          price,
          bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(offer.hotel.name + ', ' + offer.hotel.address?.cityName)}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${adults}&sb=1`,
          score: 0 
        };
      });

      // Sorting Logic
      if (sortBy === 'price_asc') {
        mappedOffers.sort((a: any, b: any) => a.price - b.price);
      } else if (sortBy === 'price_desc') {
        mappedOffers.sort((a: any, b: any) => b.price - a.price);
      } else {
        // Recommended: Filter low rating and score
        const minRating = 3;
        mappedOffers = mappedOffers.filter((o: any) => o.rating >= minRating);

        if (mappedOffers.length > 1) {
            const prices = mappedOffers.map((o: any) => o.price);
            const ratings = mappedOffers.map((o: any) => o.rating);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const ratingRange = Math.max(...ratings) - Math.min(...ratings);
            const priceRange = maxPrice - minPrice;

            mappedOffers = mappedOffers.map((o: any) => {
                const normPrice = priceRange > 0 ? (o.price - minPrice) / priceRange : 0;
                const priceScore = 1 - normPrice;
                const normRating = o.rating / 5; // Simple normalized rating
                // Weighted score
                const score = (0.4 * priceScore + 0.6 * normRating) * 100;
                return { ...o, score };
            });
            mappedOffers.sort((a: any, b: any) => b.score - a.score);
        }
      }

      return new Response(JSON.stringify({ data: mappedOffers }), { 
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        } 
      });

    } catch (e: any) {
      console.error('Hotel Search Error:', e);
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Handle logging requests with JWT Verification
  if (apiProvider === 'log' && pathSegments[1] === 'search' && request.method === 'POST') {
    try {
      if (!env.LOG_DB) {
        console.warn('LOG_DB (KV Namespace) is not configured. Skipping search logging.');
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
      if (!query) {
        return new Response('Missing query.', { status: 400 });
      }
      
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
            status: 500, // Return 500 to indicate config error, but return JSON so client can see it
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
  const cache = await caches.open('default');
  const cacheKey = new Request(url.toString(), request);
  if (isLocationSearch && request.method === 'GET') {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
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

    if (isLocationSearch && request.method === 'GET' && apiResponse.ok) {
      const responseToCache = new Response(responseToReturn.clone().body, responseToReturn);
      responseToCache.headers.set('Cache-Control', 's-maxage=86400');
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
