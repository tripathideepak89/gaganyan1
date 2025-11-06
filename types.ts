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
}


export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | FlightOffer[] | Location[];
}
