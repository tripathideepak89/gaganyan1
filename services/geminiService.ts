import { GoogleGenAI, Type, FunctionDeclaration, Chat } from '@google/genai';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY environment variable not set');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const searchFlightsFunctionDeclaration: FunctionDeclaration = {
  name: 'searchFlights',
  description:
    'Searches for available flights based on origin, destination, and departure date.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      origin: {
        type: Type.STRING,
        description:
          'The departure airport code, e.g., "SFO", "LAX".',
      },
      destination: {
        type: Type.STRING,
        description:
          'The arrival airport code, e.g., "JFK", "ORD".',
      },
      departureDate: {
        type: Type.STRING,
        description: 'The date of departure in YYYY-MM-DD format.',
      },
      adults: {
        type: Type.NUMBER,
        description: 'The number of adult passengers (age 12 and over).',
      },
      children: {
        type: Type.NUMBER,
        description: 'The number of child passengers (age 2-11).',
      },
    },
    required: ['origin', 'destination', 'departureDate', 'adults'],
  },
};

const searchCityCodeFunctionDeclaration: FunctionDeclaration = {
  name: 'searchCityCode',
  description:
    'Searches for city and airport IATA codes based on a keyword, like a city name.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      keyword: {
        type: Type.STRING,
        description: 'The city or airport name to search for, e.g., "Munich", "London".',
      },
    },
    required: ['keyword'],
  },
};

export const chat: Chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are a friendly and helpful flight booking assistant.
      Your goal is to help users find flights. You can search by number of adults and children. When a user provides a passenger's age, categorize them: "adults" are 12 and over, and "children" are ages 2-11. If a user says "kid", assume they are a "child". You do not need to handle infants (under age 2).
      First, you must determine the IATA codes for the origin and destination cities by using the searchCityCode tool.
      Do not ask the user for the IATA code. Use the tool to find it.
      Once you have the IATA codes, use the searchFlights tool to find flight information.
      If a tool returns no results (e.g., no flights found, or a city is not found), you MUST inform the user about this and ask for more information or a different query. Do not try the same tool call again with the same parameters.
      If the user does not specify the number of adults, assume 1.
      Do not make up flight information. Only use the provided tools.
      If you don't have enough information, ask the user for it.
      Today's date is ${new Date().toISOString().split('T')[0]}.`,
    tools: [{ functionDeclarations: [searchFlightsFunctionDeclaration, searchCityCodeFunctionDeclaration] }],
  },
});