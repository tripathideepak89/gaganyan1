
import { FlightOffer, Location, FlightSegment, Itinerary, HotelOffer, HotelAddress } from '../types';
import { getAirlineBookingUrl, formatISODuration } from './utils';

const AMADEUS_PROXY_URL = '/api/amadeus';

export const searchCityCode = async (keyword: string): Promise<Location[]> => {
  console.log(`Searching for city code with keyword: ${keyword}`);
  try {
    const targetUrl = `${AMADEUS_PROXY_URL}/v1/reference-data/locations?subType=CITY,AIRPORT&keyword=${encodeURIComponent(keyword.toUpperCase())}`;
    const response = await fetch(targetUrl);

    if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
    
    const data = await response.json();
    const locations: Location[] = data.data.map((loc: any) => ({
        name: loc.name,
        iataCode: loc.iataCode,
        subType: loc.subType,
        geoCode: loc.geoCode,
    }));
    
    console.log(`Found ${locations.length} locations for "${keyword}".`);
    return locations;
  } catch (error) {
    console.error(`Error in searchCityCode for keyword "${keyword}":`, error);
    return [];
  }
};


export const searchFlights = async (
  origin: string, destination: string, departureDate: string, adults: number,
  children: number, returnDate?: string
): Promise<FlightOffer[]> => {
  console.log(
    `Searching for flights from ${origin} to ${destination} on ${departureDate} ${returnDate ? `returning on ${returnDate}`: ''} for ${adults} adults and ${children} children.`
  );
  
  try {
    const params = new URLSearchParams({
      originLocationCode: origin.toUpperCase(),
      destinationLocationCode: destination.toUpperCase(),
      departureDate: departureDate,
      adults: adults.toString(),
      currencyCode: 'USD',
      max: '25',
    });
    
    if (children > 0) params.append('children', children.toString());
    if (returnDate) params.append('returnDate', returnDate);

    const targetUrl = `${AMADEUS_PROXY_URL}/v2/shopping/flight-offers?${params.toString()}`;
    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Amadeus API Error Response:', errorText);
      // If 400 (Bad Request), it typically means no flights for the route/params or a validation error.
      // Return empty array to allow the app to continue smoothly.
      if (response.status === 400) return [];
      throw new Error(`Amadeus API call failed: ${response.status} - ${errorText}`);
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
            origin: { code: segment.departure.iataCode, time: new Date(segment.departure.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
            destination: { code: segment.arrival.iataCode, time: new Date(segment.arrival.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
            duration: formatISODuration(segment.duration), airline: carrier, flightNumber: `${segment.carrierCode}${segment.number}`,
          };
        });

        return {
          duration: formatISODuration(itinerary.duration), stops: itinerary.segments.length - 1, segments,
          origin: { code: firstSegment.departure.iataCode, time: new Date(firstSegment.departure.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
          destination: { code: lastSegment.arrival.iataCode, time: new Date(lastSegment.arrival.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
        };
      });

      const carrierCode = offer.itineraries[0].segments[0].carrierCode;
      return {
        id: offer.id, price: parseFloat(offer.price.total), itineraries,
        airline: data.dictionaries.carriers[carrierCode] || carrierCode,
        bookingUrl: getAirlineBookingUrl(carrierCode, origin, destination, departureDate, returnDate),
      };
    });

    console.log(`Found ${flightOffers.length} flight offers.`);
    return flightOffers;
  } catch (error) {
    console.error(`Error in searchFlights:`, error);
    throw error; // Re-throw to allow App.tsx to show the error
  }
};

export const searchHotels = async (
    cityCode: string, checkInDate: string, checkOutDate: string, adults: number, sortBy: string = 'recommended'
): Promise<HotelOffer[]> => {
    console.log(`Searching for hotels in ${cityCode} from ${checkInDate} to ${checkOutDate} for ${adults} adults (Sort: ${sortBy}).`);
    try {
        const params = new URLSearchParams({
            cityCode, checkIn: checkInDate, checkOut: checkOutDate, adults: adults.toString(), sortBy
        });
        
        const response = await fetch(`/api/hotels/search?${params.toString()}`);

        if (!response.ok) {
            console.error('Hotel Search API Error Response:', await response.text());
            throw new Error(`Failed to fetch hotel offers with status: ${response.status}`);
        }

        const data = await response.json();
        const offers = data.data || [];
        
        console.log(`Found ${offers.length} hotel offers.`);
        return offers;
    } catch (error) {
        console.error(`Error in searchHotels:`, error);
        return [];
    }
};

export const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
    console.log(`Reverse geocoding for lat: ${latitude}, lon: ${longitude}`);
    try {
        const params = new URLSearchParams({
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            radius: '100', // Search within a 100KM radius for the nearest city/airport
        });
        const targetUrl = `${AMADEUS_PROXY_URL}/v1/reference-data/locations/airports?${params.toString()}`;
        const response = await fetch(targetUrl);

        if (!response.ok) {
            // Log but don't throw, return null to handle gracefully
            console.warn('Amadeus Reverse Geocode API returned status:', response.status);
            return null;
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            console.log('No locations found for the given coordinates.');
            return null;
        }

        // Return the city name of the first (closest) result
        const cityName = data.data[0]?.address?.cityName;
        console.log(`Found city: ${cityName}`);
        return cityName || null;

    } catch (error) {
        console.error('Error in reverseGeocode:', error);
        return null;
    }
};
