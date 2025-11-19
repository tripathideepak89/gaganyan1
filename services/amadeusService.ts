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
    cityCode: string, checkInDate: string, checkOutDate: string, adults: number
): Promise<HotelOffer[]> => {
    console.log(`Searching for hotels in ${cityCode} from ${checkInDate} to ${checkOutDate} for ${adults} adults.`);
    try {
        // Step 1: Get hotel IDs for the given city
        console.log(`Step 1: Fetching hotel list for city ${cityCode}...`);
        const hotelListParams = new URLSearchParams({ cityCode, radius: '20', radiusUnit: 'KM' });
        const hotelListTargetUrl = `${AMADEUS_PROXY_URL}/v1/reference-data/locations/hotels/by-city?${hotelListParams.toString()}`;
        const hotelListResponse = await fetch(hotelListTargetUrl);

        if (!hotelListResponse.ok) {
            console.error('Amadeus Hotel List API Error Response:', await hotelListResponse.text());
            throw new Error(`Failed to fetch hotel list with status: ${hotelListResponse.status}`);
        }

        const hotelListData = await hotelListResponse.json();
        if (!hotelListData.data || hotelListData.data.length === 0) {
            console.log(`No hotels found for city code ${cityCode}.`);
            return [];
        }

        const hotelIds = hotelListData.data.slice(0, 50).map((hotel: any) => hotel.hotelId).join(',');
        console.log(`Step 1 successful. Found ${hotelListData.data.length} hotels, using IDs for the first ${hotelIds.split(',').length}.`);

        // Step 2: Get offers for the found hotel IDs
        console.log(`Step 2: Fetching offers for hotel IDs...`);
        const hotelOffersParams = new URLSearchParams({
            hotelIds, checkInDate, checkOutDate, adults: adults.toString(),
            currency: 'USD', paymentPolicy: 'NONE', bestRateOnly: 'true', view: 'LIGHT',
        });

        const offersTargetUrl = `${AMADEUS_PROXY_URL}/v3/shopping/hotel-offers?${hotelOffersParams.toString()}`;
        const response = await fetch(offersTargetUrl);

        if (!response.ok) {
            console.error('Amadeus Hotel Offers API Error Response:', await response.text());
            throw new Error(`API call for hotel offers failed with status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            console.log('No hotel offers found for the selected hotels.');
            return [];
        }

        const hotelOffers: HotelOffer[] = data.data
          .filter((offer: any) => offer.available && offer.hotel && offer.offers?.[0]?.price)
          .map((offer: any): HotelOffer => {
            const { hotel, offers } = offer;
            const price = offers[0].price;
            const address: HotelAddress = {
              lines: hotel.address?.lines || [],
              cityName: hotel.address?.cityName || '',
              postalCode: hotel.address?.postalCode || '',
              countryCode: hotel.address?.countryCode || '',
            };
            return {
              hotelId: hotel.hotelId, name: hotel.name,
              rating: hotel.rating ? parseInt(hotel.rating, 10) : 0,
              address: address, price: parseFloat(price.total),
              bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name + ', ' + address.cityName)}&checkin=${checkInDate}&checkout=${checkOutDate}&group_adults=${adults}&sb=1`,
            };
        });
        
        console.log(`Found ${hotelOffers.length} hotel offers.`);
        return hotelOffers;

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
            console.error('Amadeus Reverse Geocode API Error Response:', await response.text());
            throw new Error(`Failed to reverse geocode with status: ${response.status}`);
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