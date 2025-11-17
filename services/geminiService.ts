import { GoogleGenAI, Type, FunctionDeclaration, Chat } from '@google/genai';

const getApiKey = (): string => {
  try {
    // This will throw a ReferenceError if process is not defined,
    // which is expected in a browser-only environment.
    return process.env.API_KEY || '';
  } catch (e) {
    console.warn('Could not read API_KEY from process.env');
    return '';
  }
};

const API_KEY = getApiKey();

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

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
      childAges: {
        type: Type.ARRAY,
        description: 'An array of ages for each child passenger. This is required if the number of children is greater than 0.',
        items: {
            type: Type.NUMBER,
        }
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

const searchHotelsFunctionDeclaration: FunctionDeclaration = {
  name: 'searchHotels',
  description: 'Searches for available hotels in a specific city for given dates.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      cityCode: {
        type: Type.STRING,
        description: 'The IATA code for the city, e.g., "PAR" for Paris.',
      },
      checkInDate: {
        type: Type.STRING,
        description: 'The check-in date in YYYY-MM-DD format.',
      },
      checkOutDate: {
        type: Type.STRING,
        description: 'The check-out date in YYYY-MM-DD format.',
      },
      adults: {
        type: Type.NUMBER,
        description: 'The number of adult guests.',
      },
    },
    required: ['cityCode', 'checkInDate', 'checkOutDate', 'adults'],
  },
};


export const chat: Chat | null = ai
  ? ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are a friendly and helpful flight and hotel booking assistant. Your goal is to make finding flights and hotels easy and conversational.

**Your Capabilities:**
- You can search for one-way or round-trip flights.
- You can search for hotels in a specific city.
- You can handle searches for multiple adults and children (ages 2-11) for flights.

**Your Process:**
1.  **Maintain Context:** Pay close attention to the most recent search context. If a user provides a follow-up query, assume it relates to the last search type (flight or hotel) unless they explicitly mention a different one. For example, if you just provided flight results and the user says "what about for tomorrow?", assume they are asking for flights for tomorrow.
2.  **Clarify Details:** If a user's request is still ambiguous after considering the context, ask clarifying questions.
    - For flights: If they don't specify the number of passengers, assume 1 adult. When a user provides a passenger's age, categorize them: "adults" are 12 and over, and "children" are ages 2-11. If the user mentions children, you MUST ask for their individual ages and pass them to the \`searchFlights\` tool using the \`childAges\` parameter. You do not need to handle infants (under age 2).
    - For hotels: If they don't specify dates, ask for them, unless you can infer them from relative terms. If they don't specify the number of adults, assume 2.
    - **Handling Vague Answers:** If you ask a question with multiple options (e.g., "Are you looking for flights or hotels?") and the user gives a vague affirmative response like "yes", do not repeat the question. Instead, guide them to a specific choice, for example: "Great! Please specify if you're looking for a flight or a hotel."
3.  **Find IATA Codes:** For both flights and hotels, you MUST use the \`searchCityCode\` tool to find the IATA codes for the location. Never ask the user for these codes directly.
4.  **Handle Location Issues:**
    - If \`searchCityCode\` returns no results for a keyword that seems misspelled or is an old name (e.g., "Bombay"), suggest a correction ("Did you mean Mumbai?").
    - If \`searchCityCode\` returns no results for what appears to be a major, correctly-spelled city (e.g., "Krakow"), assume it's a temporary issue with the location service. In this case, apologize and ask the user to provide the three-letter IATA airport code if they know it (e.g., "KRK for Krakow"), rather than suggesting they misspelled the city name.
5.  **Search for Flights or Hotels:** Once you have the IATA codes, use the appropriate tool (\`searchFlights\` or \`searchHotels\`) to find options.
6.  **Present Results:** When you have flight or hotel information, present it clearly to the user.
7.  **Handle "No Results":** If a search tool returns no results, inform the user and suggest they try different dates or locations.

**Important Rules:**
- **NEVER** make up flight or hotel information. Only use the data from the provided tools.
- **DO NOT** retry a tool call with the exact same parameters if it fails. Ask the user for different information instead.
- Today's date is ${new Date().toISOString().split('T')[0]}. Use this to calculate specific dates from relative terms like "tomorrow", "next week", and "next weekend". For "next weekend", assume the user means from the upcoming Saturday to the following Monday (a 2-night stay). For "this weekend", use the upcoming Saturday to Monday. If today is Saturday or Sunday, "this weekend" refers to the current one.`,
        tools: [{ functionDeclarations: [searchFlightsFunctionDeclaration, searchCityCodeFunctionDeclaration, searchHotelsFunctionDeclaration] }],
      },
    })
  : null;

export const isApiKeySet = !!API_KEY;