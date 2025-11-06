import { FlightOffer, Location, FlightSegment, Itinerary } from '../types';

export const isAmadeusConfigured = (): boolean => {
    return !!process.env.AMADEUS_API_KEY && !!process.env.AMADEUS_API_SECRET;
};

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

// In-memory cache for the Amadeus API token
let authToken: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * Fetches and caches an OAuth2 token from the Amadeus API.
 * @returns {Promise<string>} The bearer token.
 */
const getAuthToken = async (): Promise<string> => {
  if (authToken && authToken.expiresAt > Date.now()) {
    return authToken.token;
  }

  const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
  const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;
  
  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
    throw new Error("Amadeus API credentials are not configured in environment variables (AMADEUS_API_KEY, AMADEUS_API_SECRET).");
  }

  console.log('Fetching new Amadeus auth token...');
  try {
    const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch Amadeus token:', errorData);
      throw new Error(`Amadeus authentication failed. Please check your environment variables. Status: ${response.status}`);
    }

    const data = await response.json();
    const expiresInMs = data.expires_in * 1000;
    authToken = {
      token: data.access_token,
      expiresAt: Date.now() + expiresInMs - 30000, // Add a 30s buffer
    };
    
    console.log('Successfully fetched Amadeus auth token.');
    return authToken.token;
  } catch (error) {
    console.error('Error in getAuthToken:', error);
    throw error;
  }
};

/**
 * Formats an ISO 8601 duration string (e.g., 'PT5H30M') into a human-readable format ('5h 30m').
 * @param {string} isoDuration The ISO 8601 duration string.
 * @returns {string} The formatted duration.
 */
const formatISODuration = (isoDuration: string): string => {
  const matches = isoDuration.match(/PT(\d+H)?(\d+M)?/);
  if (!matches) return '';
  const hours = matches[1] ? parseInt(matches[1].slice(0, -1), 10) : 0;
  const minutes = matches[2] ? parseInt(matches[2].slice(0, -1), 10) : 0;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
};


export const searchCityCode = async (keyword: string): Promise<Location[]> => {
  console.log(`Searching for city code with keyword: ${keyword}`);
  try {
    const token = await getAuthToken();
    const response = await fetch(
      `${AMADEUS_BASE_URL}/v1/reference-data/locations?subType=CITY,AIRPORT&keyword=${encodeURIComponent(keyword.toUpperCase())}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
    
    const data = await response.json();
    const locations: Location[] = data.data.map((loc: any) => ({
        name: loc.name,
        iataCode: loc.iataCode,
        subType: loc.subType,
    }));
    
    console.log(`Found ${locations.length} locations for "${keyword}".`);
    return locations;
  } catch (error) {
    console.error(`Error in searchCityCode for keyword "${keyword}":`, error);
    return []; // Return empty array on error to prevent chat from crashing
  }
};


export const searchFlights = async (
  origin: string,
  destination: string,
  departureDate: string,
  adults: number,
  children: number,
  returnDate?: string
): Promise<FlightOffer[]> => {
  console.log(
    `Searching for flights from ${origin} to ${destination} on ${departureDate} ${returnDate ? `returning on ${returnDate}`: ''} for ${adults} adults and ${children} children.`
  );
  
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departureDate,
      adults: adults.toString(),
      currencyCode: 'USD',
      max: '10',
    });
    
    if (children > 0) {
      params.append('children', children.toString());
    }
    if (returnDate) {
        params.append('returnDate', returnDate);
    }

    const response = await fetch(`${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Amadeus API Error Response:', await response.text());
      throw new Error(`API call failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      console.log('No flights found from Amadeus API.');
      return [];
    }
    
    const flightOffers: FlightOffer[] = data.data.map((offer: any): FlightOffer => {
      const itineraries: Itinerary[] = offer.itineraries.map((itinerary: any): Itinerary => {
        const firstSegment = itinerary.segments[0];
        const lastSegment = itinerary.segments[itinerary.segments.length - 1];

        const segments: FlightSegment[] = itinerary.segments.map((segment: any): FlightSegment => {
          const carrier = data.dictionaries.carriers[segment.carrierCode] || segment.carrierCode;
          return {
            origin: {
              code: segment.departure.iataCode,
              time: new Date(segment.departure.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            },
            destination: {
              code: segment.arrival.iataCode,
              time: new Date(segment.arrival.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            },
            duration: formatISODuration(segment.duration),
            airline: carrier,
            flightNumber: `${segment.carrierCode}${segment.number}`,
          };
        });

        return {
          duration: formatISODuration(itinerary.duration),
          stops: itinerary.segments.length - 1,
          segments,
          origin: {
            code: firstSegment.departure.iataCode,
            time: new Date(firstSegment.departure.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
          destination: {
            code: lastSegment.arrival.iataCode,
            time: new Date(lastSegment.arrival.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
        };
      });

      return {
        id: offer.id,
        price: parseFloat(offer.price.total),
        itineraries,
        airline: data.dictionaries.carriers[offer.itineraries[0].segments[0].carrierCode] || offer.itineraries[0].segments[0].carrierCode,
        bookingUrl: `https://www.google.com/flights?q=${origin}-${destination}-${departureDate}${returnDate ? `*${destination}-${origin}-${returnDate}` : ''}&pax=${adults},${children},0`,
      };
    });

    console.log(`Found ${flightOffers.length} flight offers.`);
    return flightOffers;
  } catch (error) {
    console.error(`Error in searchFlights:`, error);
    return []; // Return empty array on error
  }
};