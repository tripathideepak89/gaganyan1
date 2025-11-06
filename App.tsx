import React, { useState, useEffect } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { ChatMessage, MessageRole, FlightOffer, Location, Itinerary } from './types';
import { isGeminiConfigured, chat } from './services/geminiService';
import { isAmadeusConfigured, searchFlights, searchCityCode } from './services/amadeusService';
import ChatInput from './components/ChatInput';
import ChatWindow from './components/ChatWindow';

const durationToMinutes = (duration: string): number => {
  const hoursMatch = duration.match(/(\d+)h/);
  const minsMatch = duration.match(/(\d+)m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minsMatch ? parseInt(minsMatch[1], 10) : 0;
  return hours * 60 + minutes;
};

const calculateBestScores = (offers: FlightOffer[]): FlightOffer[] => {
    if (offers.length < 2) return offers.map(f => ({ ...f, score: 100 }));

    const prices = offers.map(o => o.price);
    const durations = offers.map(o => o.itineraries.reduce((sum, it) => sum + durationToMinutes(it.duration), 0));
    const stops = offers.map(o => o.itineraries.reduce((sum, it) => sum + it.stops, 0));

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const minStops = Math.min(...stops);
    const maxStops = Math.max(...stops);

    const priceRange = maxPrice - minPrice;
    const durationRange = maxDuration - minDuration;
    const stopsRange = maxStops - minStops;

    const weights = {
        price: 0.5,
        duration: 0.3,
        stops: 0.2,
    };

    return offers.map(offer => {
        const totalDuration = offer.itineraries.reduce((sum, it) => sum + durationToMinutes(it.duration), 0);
        const totalStops = offer.itineraries.reduce((sum, it) => sum + it.stops, 0);

        const normPrice = priceRange > 0 ? (offer.price - minPrice) / priceRange : 0;
        const normDuration = durationRange > 0 ? (totalDuration - minDuration) / durationRange : 0;
        const normStops = stopsRange > 0 ? (totalStops - minStops) / stopsRange : 0;

        const penalty = (
            weights.price * normPrice +
            weights.duration * normDuration +
            weights.stops * normStops
        ) * 100;

        const score = 100 - penalty;
        return { ...offer, score };
    });
};


const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  useEffect(() => {
    const geminiConfigured = isGeminiConfigured();
    const amadeusConfigured = isAmadeusConfigured();

    if (geminiConfigured && amadeusConfigured) {
      setIsConfigured(true);
      setMessages([
        {
          id: 'init',
          role: MessageRole.MODEL,
          content: "Hello! I'm your flight booking assistant. Where and when would you like to fly?",
        },
      ]);
    } else {
      setIsConfigured(false);
      const missingSecrets: string[] = [];
      if (!geminiConfigured) {
        missingSecrets.push('`API_KEY` (for Google Gemini)');
      }
      if (!amadeusConfigured) {
        missingSecrets.push('`AMADEUS_API_KEY`');
        missingSecrets.push('`AMADEUS_API_SECRET`');
      }
      
      const errorMessage = `**Configuration Required**

Hello! To enable the flight booking assistant, you need to set up your API keys. Please add the following secrets in your project's settings:

- ${missingSecrets.join('\n- ')}

Once the secrets are set, please refresh the application.`;

      setMessages([
        {
          id: 'init-error',
          role: MessageRole.MODEL,
          content: errorMessage,
        },
      ]);
    }
  }, []);

  const handleSendMessage = async (userInput: string) => {
    if (!isConfigured || !chat) {
        return;
    }

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
                    const { origin, destination, departureDate, adults, children, returnDate } = fc.args;
                    const numAdults = typeof adults === 'number' && adults > 0 ? adults : 1;
                    const numChildren = typeof children === 'number' && children >= 0 ? children : 0;

                    const systemMessage = returnDate 
                      ? `Searching round-trip flights from ${origin} to ${destination} for ${numAdults} adult(s)...`
                      : `Searching flights from ${origin} to ${destination} for ${numAdults} adult(s)...`;

                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: systemMessage }]);
                    
                    const flightOffers: FlightOffer[] = await searchFlights(origin as string, destination as string, departureDate as string, numAdults, numChildren, returnDate as string | undefined);
                    
                    const flightOffersWithScores = calculateBestScores(flightOffers);
                    flightOffersWithScores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

                    functionResponseParts.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result: flightOffersWithScores }
                        }
                    });

                    if (flightOffers.length > 0) {
                        setMessages((prev) => [...prev, { id: Date.now().toString() + '-flights', role: MessageRole.MODEL, content: flightOffersWithScores }]);
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-md">
        <h1 className="text-xl font-bold text-center text-blue-300">Gemini Flight Booker</h1>
      </header>
      <ChatWindow messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || !isConfigured} />
    </div>
  );
};

export default App;