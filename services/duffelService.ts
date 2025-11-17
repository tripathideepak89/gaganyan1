import { FlightOffer, FlightSegment, Itinerary, HotelOffer, HotelAddress } from '../types';
import { getAirlineBookingUrl, formatISODuration } from './utils';

const DUFFEL_PROXY_URL = '/api/duffel';

let duffelStaysDisabled = false;

export const searchFlights = async (
  origin: string, destination: string, departureDate: string, adults: number,
  children: number, returnDate?: string, childAges?: number[]
): Promise<FlightOffer[]> => {
  console.log(`Searching for flights with Duffel from ${origin} to ${destination}...`);

  const slices = [{ origin, destination, departure_date: departureDate }];

  if (returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }

  const passengers: { type: 'adult' | 'child', age?: number }[] = [];
  for (let i = 0; i < adults; i++) passengers.push({ type: 'adult' });
  for (let i = 0; i < children; i++) {
    const age = childAges && childAges[i] ? childAges[i] : 6;
    passengers.push({ type: 'child', age });
  }

  const requestBody = { data: { slices, passengers, cabin_class: 'economy' } };
  
  try {
    const targetUrl = `${DUFFEL_PROXY_URL}/air/offer_requests`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
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
          origin: { code: segment.origin.iata_code, time: new Date(segment.departing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
          destination: { code: segment.destination.iata_code, time: new Date(segment.arriving_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
          duration: formatISODuration(segment.duration), airline: segment.operating_carrier.name,
          flightNumber: `${segment.operating_carrier.iata_code}${segment.operating_carrier_flight_number}`,
        }));

        return {
          duration: formatISODuration(slice.duration), stops: slice.segments.length - 1, segments,
          origin: { code: firstSegment.origin.iata_code, time: new Date(firstSegment.departing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
          destination: { code: lastSegment.destination.iata_code, time: new Date(lastSegment.arriving_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
        };
      });

      const carrierCode = offer.owner.iata_code;
      return {
        id: offer.id, price: parseFloat(offer.total_amount), itineraries,
        airline: offer.owner.name, bookingUrl: getAirlineBookingUrl(carrierCode),
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
    latitude: number, longitude: number, checkInDate: string,
    checkOutDate: string, adults: number
): Promise<HotelOffer[]> => {
    if (duffelStaysDisabled) {
        console.warn("Duffel Stays API is disabled for this key. Skipping search.");
        return [];
    }

    console.log(`Searching for hotels with Duffel near lat:${latitude}, long:${longitude}...`);

    const guests: { type: 'adult' }[] = [];
    for (let i = 0; i < adults; i++) guests.push({ type: 'adult' });

    const requestBody = {
        data: {
            rooms: "1",
            location: { radius: "20", geographic_coordinates: { latitude, longitude } },
            check_in_date: checkInDate, check_out_date: checkOutDate, guests,
        }
    };

    try {
        const targetUrl = `${DUFFEL_PROXY_URL}/stays/search`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Accept-Encoding': 'gzip',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
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
                    hotelId: `duffel_${prop.id}`,
                    name: prop.name,
                    rating: prop.star_rating ? parseInt(prop.star_rating, 10) : 0,
                    address,
                    price: parseFloat(rate.total_amount),
                    bookingUrl: `https://www.google.com/travel/hotels/s?q=${encodeURIComponent(prop.name + ' ' + address.cityName)}&checkin=${checkInDate}&checkout=${checkOutDate}&adults=${adults}`,
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