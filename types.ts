
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface FlightSegment {
  origin: {
    code: string;
    time: string;
  };
  destination: {
    code:string;
    time: string;
  };
  duration: string;
  airline: string;
  flightNumber: string;
}

export interface Itinerary {
  duration: string;
  stops: number;
  segments: FlightSegment[];
  origin: { 
    code: string; 
    time: string; 
  };
  destination: { 
    code: string; 
    time: string; 
  };
}

export interface FlightOffer {
  id: string;
  price: number;
  itineraries: Itinerary[];
  bookingUrl: string;
  score?: number;
  airline: string; // Airline of the first segment for display purposes
}


export interface Location {
  name: string;
  iataCode: string;
  subType: 'CITY' | 'AIRPORT';
  geoCode?: {
    latitude: number;
    longitude: number;
  };
}

export interface HotelAddress {
  lines: string[];
  cityName: string;
  postalCode: string;
  countryCode: string;
}

export interface HotelOffer {
    hotelId: string;
    name: string;
    rating: number;
    address: HotelAddress;
    price: number;
    bookingUrl: string;
    score?: number;
}


export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | FlightOffer[] | Location[] | HotelOffer[];
}

export interface Airport {
  id: number;
  icao_code: string;
  iata_code: string;
  airport_name: string;
  city: string;
  country: string;
  latitude_degrees?: number;
  latitude_minutes?: number;
  latitude_seconds?: number;
  latitude_direction?: string;
  longitude_degrees?: number;
  longitude_minutes?: number;
  longitude_seconds?: number;
  longitude_direction?: string;
  altitude?: number;
  latitude_decimal?: number;
  longitude_decimal?: number;
}
