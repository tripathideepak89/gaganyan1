import { GoogleGenAI, Type, FunctionDeclaration, Chat } from '@google/genai';

let chat: Chat | null = null;

const API_KEY = process.env.API_KEY;

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
      returnDate: {
        type: Type.STRING,
        description: 'The return date for a round-trip flight in YYYY-MM-DD format. Omit for one-way flights.',
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

if (API_KEY) {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are a friendly and helpful flight booking assistant. Your goal is to make finding flights easy and conversational.

**Your Capabilities:**
- You can search for one-way or round-trip flights.
- You can handle searches for multiple adults and children (ages 2-11).

**Your Process:**
1.  **Clarify Details:** If a user's request is ambiguous, ask clarifying questions. For example, if they mention a return trip (e.g., "for a week," "come back on Sunday") without a specific date, ask for one. If they don't specify the number of passengers, assume 1 adult. When a user provides a passenger's age, categorize them: "adults" are 12 and over, and "children" are ages 2-11. If a user says "kid", assume they are a "child". You do not need to handle infants (under age 2).
2.  **Find Airport Codes:** You MUST use the \`searchCityCode\` tool to find the IATA codes for the origin and destination. Never ask the user for these codes directly.
3.  **Handle Location Issues:** If \`searchCityCode\` returns no results, the name might be misspelled or an old name. If you recognize a likely correction (e.g., "Bombay" -> "Mumbai"), suggest it to the user. Otherwise, ask for clarification.
4.  **Search for Flights:** Once you have the IATA codes, use the \`searchFlights\` tool to find flight options.
5.  **Present Results:** When you have flight information, present it clearly to the user.
6.  **Handle "No Flights":** If \`searchFlights\` returns no results, inform the user and suggest they try different dates or airports.

**Important Rules:**
- **NEVER** make up flight information. Only use the data from the provided tools.
- **DO NOT** retry a tool call with the exact same parameters if it fails. Ask the user for different information instead.
- Today's date is ${new Date().toISOString().split('T')[0]}. Use this for context when users mention relative dates like "tomorrow".`,
      tools: [{ functionDeclarations: [searchFlightsFunctionDeclaration, searchCityCodeFunctionDeclaration] }],
    },
  });
}

export const isGeminiConfigured = (): boolean => !!API_KEY;
export { chat };