export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface Segment {
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

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: {
    code: string;
    city: string;
    time: string;
  };
  destination: {
    code: string;
    city: string;
    time: string;
  };
  duration: string;
  price: number;
  stops: number;
  segments: Segment[];
  bookingUrl: string;
  score?: number;
}

export interface Location {
  name: string;
  iataCode: string;
  subType: 'CITY' | 'AIRPORT';
}


export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | Flight[] | Location[];
}