
interface Env {
  AMADEUS_API_KEY: string;
  AMADEUS_API_SECRET: string;
  DUFFEL_API_KEY: string;
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

// Fix: Add type definition for PagesFunction to resolve 'Cannot find name' error.
type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}) => Promise<Response>;

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const url = new URL(request.url);
  const pathSegments = params.path as string[];
  const apiProvider = pathSegments[0];
  const actualPath = pathSegments.slice(1).join('/');

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

      // Fix: Cast headers to Headers to use the .set() method, resolving 'Property 'set' does not exist on type 'HeadersInit'' error.
      (apiRequestOptions.headers as Headers).set('Authorization', `Bearer ${DUFFEL_API_KEY}`);
      // Use the correct API version based on the endpoint being called
      const duffelVersion = actualPath.startsWith('stays/') ? 'beta' : 'v1';
      (apiRequestOptions.headers as Headers).set('Duffel-Version', duffelVersion);
    } else {
      return new Response('Invalid API provider.', { status: 400 });
    }

    const apiResponse = await fetch(targetUrl, apiRequestOptions);
    
    // Create a new Headers object to make it mutable
    const responseHeaders = new Headers(apiResponse.headers);
    // Important: Allow the client to access the response from any origin
    responseHeaders.set('Access-Control-Allow-Origin', '*');

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
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
  }
};