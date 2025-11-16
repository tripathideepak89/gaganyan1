import React, { useState, useEffect } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { ChatMessage, MessageRole, FlightOffer, Location, HotelOffer } from './types';
import { chat } from './services/geminiService';
import { searchFlights as searchFlightsAmadeus, searchCityCode, searchHotels as searchHotelsAmadeus } from './services/amadeusService';
import { searchFlights as searchFlightsDuffel, searchHotels as searchHotelsDuffel } from './services/duffelService';
import ChatView from './components/ChatView';
import FlightSearchForm from './components/FlightSearchForm';
import HotelSearchForm from './components/HotelSearchForm';
import { TravelBilliLogo, PaperAirplaneIcon, BuildingOfficeIcon, ChatBubbleLeftRightIcon } from './components/IconComponents';

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

const calculateHotelScores = (offers: HotelOffer[]): HotelOffer[] => {
    if (offers.length < 2) return offers.map(o => ({ ...o, score: 100 }));

    const prices = offers.map(o => o.price);
    const ratings = offers.map(o => o.rating);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);

    const priceRange = maxPrice - minPrice;
    const ratingRange = maxRating - minRating;

    const weights = {
        price: 0.4,
        rating: 0.6,
    };

    return offers.map(offer => {
        const normPrice = priceRange > 0 ? (offer.price - minPrice) / priceRange : 0;
        const priceScore = 1 - normPrice;
        const normRating = ratingRange > 0 ? (offer.rating - minRating) / ratingRange : 0;
        const score = (weights.price * priceScore + weights.rating * normRating) * 100;
        return { ...offer, score };
    });
};

const App: React.FC = () => {
  type ActiveTab = 'flights' | 'hotels' | 'chat';
  const [activeTab, setActiveTab] = useState<ActiveTab>('flights');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [areCredentialsSet, setAreCredentialsSet] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // State for Flight Search Form
  const [tripType, setTripType] = useState<'roundtrip' | 'oneway'>('roundtrip');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depart, setDepart] = useState('');
  const [flightReturnDate, setFlightReturnDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);

  // State for Hotel Search Form
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);


  useEffect(() => {
    const amadeusKey = sessionStorage.getItem('AMADEUS_API_KEY');
    const amadeusSecret = sessionStorage.getItem('AMADEUS_API_SECRET');
    const duffelKey = sessionStorage.getItem('DUFFEL_API_KEY');
    if (amadeusKey && amadeusSecret && duffelKey) {
        setAreCredentialsSet(true);
        setShowSuggestions(true);
        setMessages([
            {
              id: 'init',
              role: MessageRole.MODEL,
              content: "Hello! I'm your travel assistant. You can ask me to find flights and hotels, or use the forms in the other tabs.",
            },
        ]);
    } else {
        setAreCredentialsSet(false);
        setMessages([
            {
              id: 'init-creds',
              role: MessageRole.MODEL,
              content: "[REQUIRE_CREDENTIALS]",
            },
        ]);
    }
  }, []);

  const handleCredentialsSaved = () => {
    setAreCredentialsSet(true);
    setShowSuggestions(true);
    setMessages(prev => {
        const filteredMessages = prev.filter(m => m.content !== "[REQUIRE_CREDENTIALS]");
        return [
            ...filteredMessages,
            {
                id: 'creds-saved',
                role: MessageRole.MODEL,
                content: "Great! Credentials are set. You can now search for flights and hotels using the forms or by chatting with me."
            }
        ];
    });
  };

  const handleSendMessage = async (userInput: string) => {
    if (!areCredentialsSet) return;
    
    setShowSuggestions(false);
    setIsLoading(true);

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: userInput,
    };
    setMessages((prevMessages) => [...prevMessages.filter(m => m.id !== 'init'), newUserMessage]);

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
                    const { origin, destination, departureDate, adults, children, returnDate, childAges } = fc.args;
                    const numAdults = typeof adults === 'number' && adults > 0 ? adults : 1;
                    const numChildren = typeof children === 'number' && children >= 0 ? children : 0;
                    const systemMessage = `Searching flights from ${origin} to ${destination} via all providers...`;
                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: systemMessage }]);
                    
                    const results = await Promise.allSettled([
                        searchFlightsAmadeus(origin as string, destination as string, departureDate as string, numAdults, numChildren, returnDate as string | undefined),
                        searchFlightsDuffel(origin as string, destination as string, departureDate as string, numAdults, numChildren, returnDate as string | undefined, childAges as number[] | undefined)
                    ]);

                    let allFlightOffers: FlightOffer[] = [];
                    results.forEach(result => {
                        if (result.status === 'fulfilled' && result.value) {
                            allFlightOffers.push(...result.value);
                        }
                    });

                    const uniqueFlightOffers = Array.from(new Map(allFlightOffers.map(offer => {
                        const firstSegment = offer.itineraries[0]?.segments[0];
                        if (!firstSegment) return [offer.id, offer];
                        const key = `${firstSegment.airline}-${firstSegment.flightNumber}-${firstSegment.origin.time}-${offer.price}`;
                        return [key, offer];
                    })).values());

                    const flightOffersWithScores = calculateBestScores(uniqueFlightOffers);
                    flightOffersWithScores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                    
                    const summaryResult = {
                        count: uniqueFlightOffers.length,
                        message: uniqueFlightOffers.length > 0 ? `Found ${uniqueFlightOffers.length} flight offers.` : "No flight offers found."
                    };
                    functionResponseParts.push({ functionResponse: { name: fc.name, response: { result: summaryResult }}});

                    if (uniqueFlightOffers.length > 0) {
                        setMessages((prev) => [...prev, { id: Date.now().toString() + '-flights', role: MessageRole.MODEL, content: flightOffersWithScores }]);
                    }
                } else if (fc.name === 'searchHotels') {
                    const { cityCode, checkInDate, checkOutDate, adults } = fc.args;
                    const numAdults = typeof adults === 'number' && adults > 0 ? adults : 2;
                    
                    const systemMessage = `Searching for hotels in ${cityCode} via all providers...`;
                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: systemMessage }]);

                    // Fetch location details to get coordinates for Duffel
                    const locations = await searchCityCode(cityCode as string);
                    const mainLocation = locations.find(l => l.subType === 'CITY') || locations[0];
                    const geoCode = mainLocation?.geoCode;

                    const hotelPromises = [
                        searchHotelsAmadeus(cityCode as string, checkInDate as string, checkOutDate as string, numAdults)
                    ];

                    if (geoCode?.latitude && geoCode?.longitude) {
                        console.log(`Found coordinates for ${cityCode}: ${geoCode.latitude}, ${geoCode.longitude}. Adding Duffel to hotel search.`);
                        hotelPromises.push(
                            searchHotelsDuffel(geoCode.latitude, geoCode.longitude, checkInDate as string, checkOutDate as string, numAdults)
                        );
                    } else {
                        console.log(`Could not find coordinates for ${cityCode}. Searching only with Amadeus.`);
                    }

                    const results = await Promise.allSettled(hotelPromises);
                    
                    let allHotelOffers: HotelOffer[] = [];
                    results.forEach(result => {
                        if (result.status === 'fulfilled' && result.value) {
                            allHotelOffers.push(...(result.value as HotelOffer[]));
                        } else if (result.status === 'rejected') {
                            if (result.reason?.message?.includes("Duffel Stays API feature is not enabled")) {
                                const duffelErrorMessage: ChatMessage = {
                                    id: Date.now().toString() + '-duffel-error',
                                    role: MessageRole.SYSTEM,
                                    content: "Note: The Duffel Stays API is not enabled for your key. Showing results from other providers only."
                                };
                                setMessages((prev) => [...prev, duffelErrorMessage]);
                            }
                        }
                    });

                    // Simple deduplication based on hotel name and city
                    const uniqueHotelOffers = Array.from(new Map(allHotelOffers.map(offer => {
                        const key = `${offer.name.toLowerCase().trim()}-${offer.address.cityName.toLowerCase().trim()}`;
                        return [key, offer];
                    })).values());
                    
                    const hotelOffersWithScores = calculateHotelScores(uniqueHotelOffers);
                    hotelOffersWithScores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                    
                    const summaryResult = {
                        count: uniqueHotelOffers.length,
                        message: uniqueHotelOffers.length > 0 ? `Found ${uniqueHotelOffers.length} hotels.` : "No hotels found."
                    };
                    functionResponseParts.push({ functionResponse: { name: fc.name, response: { result: summaryResult }}});
                    
                    if (uniqueHotelOffers.length > 0) {
                        setMessages((prev) => [...prev, { id: Date.now().toString() + '-hotels', role: MessageRole.MODEL, content: hotelOffersWithScores }]);
                    }
                } else if (fc.name === 'searchCityCode') {
                    const { keyword } = fc.args;
                    setMessages((prev) => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: `Looking up city code for "${keyword}"...` }]);
                    const locations: Location[] = await searchCityCode(keyword as string);
                    functionResponseParts.push({ functionResponse: { name: fc.name, response: { result: locations }}});
                     if (locations.length > 0) {
                        setMessages((prev) => [...prev, { id: Date.now().toString() + '-locations', role: MessageRole.MODEL, content: locations }]);
                    }
                }
            }

            if (functionResponseParts.length > 0) {
                response = await chat.sendMessage({ message: functionResponseParts as any});
            } else {
                break; 
            }
        }
        
        const modelResponseText = response.text?.trim();
        if (modelResponseText) {
            const newModelMessage: ChatMessage = { id: Date.now().toString() + '-model', role: MessageRole.MODEL, content: modelResponseText };
            setMessages((prevMessages) => [...prevMessages, newModelMessage]);
        }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessageText = error instanceof Error ? error.message : 'Sorry, something went wrong. Please check the console for details.';
      const errorMessage: ChatMessage = { id: Date.now().toString() + '-error', role: MessageRole.MODEL, content: errorMessageText };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSearch = (query: string) => {
    setActiveTab('chat');
    handleSendMessage(query);
  };

  const TabButton: React.FC<{ tabName: ActiveTab; icon: React.ReactNode; label: string; }> = ({ tabName, icon, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex-1 flex items-center justify-center gap-x-2 p-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
        activeTab === tabName
          ? 'border-blue-500 text-blue-400'
          : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-md">
        <div className="flex items-center justify-center gap-x-3">
          <TravelBilliLogo className="w-10 h-10 text-blue-300" />
          <h1 className="text-xl font-bold text-center text-blue-300">travelbilli</h1>
        </div>
      </header>
      
      <div className="bg-gray-800 border-b border-gray-700">
        <nav className="max-w-4xl mx-auto flex" aria-label="Tabs">
          <TabButton tabName="flights" label="Flights" icon={<PaperAirplaneIcon className="w-5 h-5 -rotate-45" />} />
          <TabButton tabName="hotels" label="Hotels" icon={<BuildingOfficeIcon className="w-5 h-5" />} />
          <TabButton tabName="chat" label="Chat" icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />} />
        </nav>
      </div>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'flights' && (
            <FlightSearchForm 
                onSearch={handleFormSearch} 
                isLoading={isLoading || !areCredentialsSet}
                tripType={tripType}
                setTripType={setTripType}
                from={from}
                setFrom={setFrom}
                to={to}
                setTo={setTo}
                depart={depart}
                setDepart={setDepart}
                returnDate={flightReturnDate}
                setReturnDate={setFlightReturnDate}
                adults={adults}
                setAdults={setAdults}
                childrenCount={childrenCount}
                setChildrenCount={setChildrenCount}
                childAges={childAges}
                setChildAges={setChildAges}
            />
        )}
        {activeTab === 'hotels' && (
            <HotelSearchForm 
                onSearch={handleFormSearch} 
                isLoading={isLoading || !areCredentialsSet}
                destination={destination}
                setDestination={setDestination}
                checkIn={checkIn}
                setCheckIn={setCheckIn}
                checkOut={checkOut}
                setCheckOut={setCheckOut}
                guests={guests}
                setGuests={setGuests}
            />
        )}
        {activeTab === 'chat' && (
            <ChatView
                messages={messages}
                isLoading={isLoading}
                onSendMessage={handleSendMessage}
                onCredentialsSaved={handleCredentialsSaved}
                areCredentialsSet={areCredentialsSet}
                showSuggestions={showSuggestions}
            />
        )}
      </main>
    </div>
  );
};

export default App;
