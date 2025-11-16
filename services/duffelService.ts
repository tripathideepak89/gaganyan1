import { FlightOffer, FlightSegment, Itinerary, HotelOffer, HotelAddress } from '../types';

const PROXY_URL = 'https://proxy.cors.sh/';
const DUFFEL_BASE_URL = 'https://api.duffel.com';

let duffelStaysDisabled = false;

const airlineWebsiteMap: { [carrierCode: string]: string } = {
  'AA': 'https://www.aa.com/',
  'DL': 'https://www.delta.com/',
  'UA': 'https://www.united.com/',
  'WN': 'https://www.southwest.com/',
  'B6': 'https://www.jetblue.com/',
  'AS': 'https://www.alaskaair.com/',
  'NK': 'https://www.spirit.com/',
  'F9': 'https://www.flyfrontier.com/',
  'HA': 'https://www.hawaiianairlines.com/',
  'LH': 'https://www.lufthansa.com/',
  'BA': 'https://www.britishairways.com/',
  'AF': 'https://www.airfrance.us/',
  'KL': 'https://www.klm.com/',
  'EK': 'https://www.emirates.com/',
  'QR': 'https://www.qatarairways.com/',
  'SQ': 'https://www.singaporeair.com/',
  'CX': 'https://www.cathaypacific.com/',
  'NH': 'https://www.ana.co.jp/',
  'JL': 'https://www.jal.co.jp/',
  'KE': 'https://www.koreanair.com/',
  'EY': 'https://www.etihad.com/',
  'TK': 'https://www.turkishairlines.com/',
};

const getAirlineBookingUrl = (carrierCode: string): string => {
  const baseUrl = airlineWebsiteMap[carrierCode.toUpperCase()];
  if (baseUrl) {
    const url = new URL(baseUrl);
    url.searchParams.append('utm_source', 'travelbilli_ai_travel');
    url.searchParams.append('utm_medium', 'referral');
    return url.toString();
  }
  // Fallback to a Google search for the airline if not in our map.
  return `https://www.google.com/search?q=${encodeURIComponent(carrierCode + ' airline booking')}`;
};

const formatISODuration = (isoDuration: string): string => {
  if (!isoDuration) return '';
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

export const searchFlights = async (
  origin: string,
  destination: string,
  departureDate: string,
  adults: number,
  children: number,
  returnDate?: string,
  childAges?: number[]
): Promise<FlightOffer[]> => {
  console.log(`Searching for flights with Duffel from ${origin} to ${destination}...`);
  
  const DUFFEL_API_KEY = process.env.DUFFEL_API_KEY;
  if (!DUFFEL_API_KEY) {
    console.warn("Duffel API key is not configured as an environment variable.");
    return [];
  }

  const slices = [{
    origin,
    destination,
    departure_date: departureDate,
  }];

  if (returnDate) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: returnDate,
    });
  }

  const passengers: { type: 'adult' | 'child', age?: number }[] = [];
  for (let i = 0; i < adults; i++) {
    passengers.push({ type: 'adult' });
  }
  for (let i = 0; i < children; i++) {
    // Duffel requires an age for child passengers.
    // Use the provided age, or default to 6 if not available.
    const age = childAges && childAges[i] ? childAges[i] : 6;
    passengers.push({ type: 'child', age });
  }

  const requestBody = {
    data: {
      slices,
      passengers,
      cabin_class: 'economy',
    },
  };
  
  try {
    const targetUrl = `${DUFFEL_BASE_URL}/air/offer_requests`;
    const response = await fetch(`${PROXY_URL}${targetUrl}`, {
      method: 'POST',
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Duffel-Version': 'v2',
        'Authorization': `Bearer ${DUFFEL_API_KEY}`,
        'x-cors-api-key': 'temp_220935574a781b452816823c46b5e1d5'
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Duffel API Error Response:', errorText);
        return [];
    }
    
    const data = await response.json();
    if (!data.data || !data.data.offers || data.data.offers.length === 0) {
      console.log('No flights found from Duffel API.');
      return [];
    }

    const flightOffers: FlightOffer[] = data.data.offers.map((offer: any): FlightOffer => {
      const itineraries: Itinerary[] = offer.slices.map((slice: any): Itinerary => {
        const firstSegment = slice.segments[0];
        const lastSegment = slice.segments[slice.segments.length - 1];
        
        const segments: FlightSegment[] = slice.segments.map((segment: any): FlightSegment => ({
          origin: {
            code: segment.origin.iata_code,
            time: new Date(segment.departing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
          destination: {
            code: segment.destination.iata_code,
            time: new Date(segment.arriving_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
          duration: formatISODuration(segment.duration),
          airline: segment.operating_carrier.name,
          flightNumber: `${segment.operating_carrier.iata_code}${segment.operating_carrier_flight_number}`,
        }));

        return {
          duration: formatISODuration(slice.duration),
          stops: slice.segments.length - 1,
          segments,
          origin: {
            code: firstSegment.origin.iata_code,
            time: new Date(firstSegment.departing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
          destination: {
            code: lastSegment.destination.iata_code,
            time: new Date(lastSegment.arriving_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          },
        };
      });

      const carrierCode = offer.owner.iata_code;
      return {
        id: offer.id,
        price: parseFloat(offer.total_amount),
        itineraries,
        airline: offer.owner.name,
        bookingUrl: getAirlineBookingUrl(carrierCode),
      };
    });

    console.log(`Found ${flightOffers.length} flight offers from Duffel.`);
    return flightOffers;
  } catch (error) {
    console.error(`Error in Duffel searchFlights:`, error);
    return [];
  }
};

export const searchHotels = async (
    latitude: number,
    longitude: number,
    checkInDate: string,
    checkOutDate: string,
    adults: number,
): Promise<HotelOffer[]> => {
    if (duffelStaysDisabled) {
        console.warn("Duffel Stays API is disabled for this key. Skipping search.");
        return [];
    }

    console.log(`Searching for hotels with Duffel near lat:${latitude}, long:${longitude}...`);

    const DUFFEL_API_KEY = process.env.DUFFEL_API_KEY;
    if (!DUFFEL_API_KEY) {
        console.warn("Duffel API key is not configured as an environment variable.");
        return [];
    }

    const guests: { type: 'adult' }[] = [];
    for (let i = 0; i < adults; i++) {
        guests.push({ type: 'adult' });
    }

    const requestBody = {
        data: {
            rooms: "1", // Assuming 1 room for now as per the curl example.
            location: {
                radius: "20", // Search within 20 KM, similar to Amadeus
                geographic_coordinates: {
                    latitude,
                    longitude,
                }
            },
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            guests,
        }
    };

    try {
        const targetUrl = `${DUFFEL_BASE_URL}/stays/search`;
        const response = await fetch(`${PROXY_URL}${targetUrl}`, {
            method: 'POST',
            headers: {
                'Accept-Encoding': 'gzip',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Duffel-Version': 'v2',
                'Authorization': `Bearer ${DUFFEL_API_KEY}`,
                'x-cors-api-key': 'temp_220935574a781b452816823c46b5e1d5'
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (errorText.includes("This feature is not enabled for your account")) {
                console.warn("Duffel Stays API feature is not enabled. Disabling for session.");
                duffelStaysDisabled = true;
                throw new Error("Duffel Stays API feature is not enabled for your account.");
            }
            console.error('Duffel Stays API Error Response:', errorText);
            return [];
        }

        const data = await response.json();
        if (!data.data || !data.data.properties || data.data.properties.length === 0) {
            console.log('No hotels found from Duffel Stays API.');
            return [];
        }

        const hotelOffers: HotelOffer[] = data.data.properties
            .filter((prop: any) => prop.rates && prop.rates.length > 0)
            .map((prop: any): HotelOffer => {
                const rate = prop.rates[0];
                const address: HotelAddress = {
                    lines: [prop.address.line_1].filter(Boolean),
                    cityName: prop.address.city_name,
                    postalCode: prop.address.postal_code,
                    countryCode: prop.address.country_code,
                };

                return {
                    hotelId: `duffel_${prop.id}`, // Prefix to avoid collision with Amadeus IDs
                    name: prop.name,
                    rating: prop.star_rating ? parseInt(prop.star_rating, 10) : 0,
                    address,
                    price: parseFloat(rate.total_amount),
                    bookingUrl: `https://www.google.com/search?q=${encodeURIComponent(prop.name)}+${encodeURIComponent(address.cityName)}`,
                };
        });

        console.log(`Found ${hotelOffers.length} hotel offers from Duffel.`);
        return hotelOffers;

    } catch (error) {
        if (error instanceof Error && error.message.includes("Duffel Stays API feature is not enabled")) {
            throw error;
        }
        console.error(`Error in Duffel searchHotels:`, error);
        return [];
    }
};
