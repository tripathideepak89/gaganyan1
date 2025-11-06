import React, { useState, useEffect } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { ChatMessage, MessageRole, Flight, Location } from './types';
import { chat } from './services/geminiService';
import { searchFlights, searchCityCode } from './services/amadeusService';
import ChatInput from './components/ChatInput';
import ChatWindow from './components/ChatWindow';

const durationToMinutes = (duration: string): number => {
  const hoursMatch = duration.match(/(\d+)h/);
  const minsMatch = duration.match(/(\d+)m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minsMatch ? parseInt(minsMatch[1], 10) : 0;
  return hours * 60 + minutes;
};

const calculateBestScores = (flights: Flight[]): Flight[] => {
    if (flights.length < 2) return flights.map(f => ({ ...f, score: 100 }));

    const prices = flights.map(f => f.price);
    const durations = flights.map(f => durationToMinutes(f.duration));
    const stops = flights.map(f => f.stops);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const minStops = Math.min(...stops);
    const maxStops = Math.max(...stops);

    const priceRange = maxPrice - minPrice;
    const durationRange = maxDuration - minDuration;
    const stopsRange = maxStops - minStops;

    // Weights for scoring criteria
    const weights = {
        price: 0.5,
        duration: 0.3,
        stops: 0.2,
    };

    return flights.map(flight => {
        const normPrice = priceRange > 0 ? (flight.price - minPrice) / priceRange : 0;
        const normDuration = durationRange > 0 ? (durationToMinutes(flight.duration) - minDuration) / durationRange : 0;
        const normStops = stopsRange > 0 ? (flight.stops - minStops) / stopsRange : 0;

        // Lower is better for all metrics. We calculate a total penalty score.
        const penalty = (
            weights.price * normPrice +
            weights.duration * normDuration +
            weights.stops * normStops
        ) * 100;

        // The final score is inverted: 100 is best, 0 is worst.
        const score = 100 - penalty;
        return { ...flight, score };
    });
};


const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [amadeusKey, setAmadeusKey] = useState('');
  const [amadeusSecret, setAmadeusSecret] = useState('');
  const [credentialsSet, setCredentialsSet] = useState(false);

  useEffect(() => {
    const key = process.env.AMADEUS_API_KEY || sessionStorage.getItem('AMADEUS_API_KEY');
    const secret = process.env.AMADEUS_API_SECRET || sessionStorage.getItem('AMADEUS_API_SECRET');
    if (key && secret) {
      setCredentialsSet(true);
    }
  }, []);

  useEffect(() => {
    if (credentialsSet) {
      setMessages([
        {
          id: 'init',
          role: MessageRole.MODEL,
          content: "Hello! I'm your flight booking assistant. Where and when would you like to fly?",
        },
      ]);
    }
  }, [credentialsSet]);

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amadeusKey.trim() && amadeusSecret.trim()) {
      sessionStorage.setItem('AMADEUS_API_KEY', amadeusKey);
      sessionStorage.setItem('AMADEUS_API_SECRET', amadeusSecret);
      setCredentialsSet(true);
    }
  };

  const handleSendMessage = async (userInput: string) => {
    setIsLoading(true);
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: userInput,
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);

    try {
        let response: GenerateContentResponse = await chat.sendMessage({ message: userInput });
        
        let executionCount = 0;
        const MAX_EXECUTIONS = 5;

        while(response.functionCalls && response.functionCalls.length > 0) {
            if (executionCount >= MAX_EXECUTIONS) {
                throw new Error("I seem to be stuck in a loop. Please try rephrasing your request.");
            }
            executionCount++;

            const functionCalls = response.functionCalls;
            const functionResponseParts = [];

            for (const fc of functionCalls) {
                if (fc.name === 'searchFlights') {
                    const { origin, destination, departureDate, adults, children } = fc.args;
                    const numAdults = typeof adults === 'number' && adults > 0 ? adults : 1;
                    const numChildren = typeof children === 'number' && children >= 0 ? children : 0;

                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: `Searching flights from ${origin} to ${destination} for ${numAdults} adult(s)...` }]);
                    
                    const flights: Flight[] = await searchFlights(origin as string, destination as string, departureDate as string, numAdults, numChildren);
                    
                    const flightsWithScores = calculateBestScores(flights);
                    flightsWithScores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

                    functionResponseParts.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result: flightsWithScores }
                        }
                    });

                    if (flights.length > 0) {
                        setMessages((prev) => [...prev, { id: Date.now().toString() + '-flights', role: MessageRole.MODEL, content: flightsWithScores }]);
                    }
                } else if (fc.name === 'searchCityCode') {
                    const { keyword } = fc.args;
                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: `Looking up city code for "${keyword}"...` }]);

                    const locations: Location[] = await searchCityCode(keyword as string);

                    functionResponseParts.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result: locations }
                        }
                    });

                     if (locations.length > 0) {
                        setMessages((prev) => [...prev, { id: Date.now().toString() + '-locations', role: MessageRole.MODEL, content: locations }]);
                    }
                }
            }

            if (functionResponseParts.length > 0) {
                response = await chat.sendMessage({ message: functionResponseParts });
            } else {
                break; 
            }
        }
        
        const modelResponseText = response.text.trim();
        if (modelResponseText) {
            const newModelMessage: ChatMessage = {
                id: Date.now().toString() + '-model',
                role: MessageRole.MODEL,
                content: modelResponseText,
            };
            setMessages((prevMessages) => [...prevMessages, newModelMessage]);
        }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessageText = error instanceof Error ? error.message : 'Sorry, something went wrong. Please check the console for details.';
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '-error',
        role: MessageRole.MODEL,
        content: errorMessageText,
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!credentialsSet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-blue-300 mb-4">Amadeus API Credentials</h1>
          <p className="text-center text-gray-400 mb-6">
            To use the flight search, please provide your Amadeus for Developers API credentials.
            These will be stored in your browser's session and not on any server.
          </p>
          <form onSubmit={handleCredentialSubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300">API Key</label>
              <input
                id="apiKey"
                type="password"
                value={amadeusKey}
                onChange={(e) => setAmadeusKey(e.target.value)}
                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-300">API Secret</label>
              <input
                id="apiSecret"
                type="password"
                value={amadeusSecret}
                onChange={(e) => setAmadeusSecret(e.target.value)}
                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            >
              Save and Continue
            </button>
          </form>
          <p className="text-center text-gray-500 text-xs mt-6">
            Don't have credentials? Get them from the{' '}
            <a href="https://developers.amadeus.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              Amadeus for Developers portal
            </a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-md">
        <h1 className="text-xl font-bold text-center text-blue-300">Gemini Flight Booker</h1>
      </header>
      <ChatWindow messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default App;
