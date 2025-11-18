
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
  ident: string;
  type: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_ft: number;
  continent: string;
  iso_country: string;
  iso_region: string;
  municipality: string;
  scheduled_service: string;
  icao_code: string;
  iata_code: string;
  gps_code: string;
  local_code: string;
  home_link: string;
  wikipedia_link: string;
  keywords: string;
}
