import React, { useState, useEffect, useMemo } from 'react';
import { ChatMessage as Message, MessageRole, FlightOffer, Location, FlightSegment, Itinerary } from '../types';
import { BotIcon, PlaneIcon, ArrowRightIcon } from './IconComponents';

interface ChatMessageProps {
  message: Message;
}

const durationToMinutes = (duration: string): number => {
  const hoursMatch = duration.match(/(\d+)h/);
  const minsMatch = duration.match(/(\d+)m/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minsMatch ? parseInt(minsMatch[1], 10) : 0;
  return hours * 60 + minutes;
};

const totalDuration = (itineraries: Itinerary[]): number => {
  return itineraries.reduce((sum, it) => sum + durationToMinutes(it.duration), 0);
};

const ItineraryView: React.FC<{ itinerary: Itinerary; title: string }> = ({ itinerary, title }) => (
  <div className="mt-3 pt-3 border-t border-gray-600">
    <h4 className="text-sm font-semibold text-gray-400 mb-2">{title}</h4>
    <div className="flex items-center justify-between text-white">
      <div className="text-center">
        <div className="text-2xl font-bold">{itinerary.origin.code}</div>
        <div className="text-sm text-gray-400">{itinerary.origin.time}</div>
      </div>
      <div className="flex-1 flex items-center mx-4">
        <div className="w-full h-px bg-gray-500 relative">
          <PlaneIcon className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-700 px-1 text-blue-400" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">{itinerary.destination.code}</div>
        <div className="text-sm text-gray-400">{itinerary.destination.time}</div>
      </div>
    </div>
    <div className="text-center text-sm text-gray-300 mt-2">
      {itinerary.duration}
      <span className="text-gray-400 mx-1">&bull;</span>
      {itinerary.stops === 0 ? 'Non-stop' : `${itinerary.stops} stop${itinerary.stops > 1 ? 's' : ''}`}
    </div>
  </div>
);


const FlightOfferCard: React.FC<{ flightOffer: FlightOffer }> = ({ flightOffer }) => {
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  return (
    <div className="bg-gray-700 rounded-lg shadow-md p-4 mt-3 max-w-lg border border-gray-600 transition-all duration-300 ease-in-out">
      <div className="flex justify-between items-center mb-3">
        <div className="font-bold text-lg text-blue-300">{flightOffer.airline}</div>
        <div className="text-xl font-semibold text-white">${flightOffer.price.toFixed(2)}</div>
      </div>
      
      {flightOffer.itineraries.map((itinerary, index) => (
        <ItineraryView key={index} itinerary={itinerary} title={index === 0 ? 'Outbound' : 'Return'} />
      ))}

       <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-600">
        <button 
          onClick={() => setDetailsVisible(!detailsVisible)} 
          className="text-sm text-blue-400 hover:underline focus:outline-none"
        >
          {detailsVisible ? 'Hide details' : 'Show details'}
        </button>
        <a 
          href={flightOffer.bookingUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
        >
          Book Now
        </a>
      </div>
      {detailsVisible && (
        <div className="mt-4 border-t border-gray-600 pt-3 space-y-4">
           {flightOffer.itineraries.map((itinerary, i) => (
             <div key={i}>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">{i === 0 ? 'Outbound Segments' : 'Return Segments'}</h4>
                {itinerary.segments.map((seg, index) => (
                    <div key={index} className="text-sm text-gray-200 flex items-center justify-between">
                    <div className="flex-shrink-0">
                        <div className="font-mono">{seg.origin.code} &rarr; {seg.destination.code}</div>
                        <div className="text-xs text-gray-400">{seg.airline} {seg.flightNumber}</div>
                    </div>
                    <div className="text-xs text-gray-400">{seg.duration}</div>
                    </div>
                ))}
             </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LocationCard: React.FC<{ location: Location }> = ({ location }) => (
  <div className="bg-gray-700 rounded-lg shadow-md p-3 mt-2 max-w-sm border border-gray-600 flex justify-between items-center">
    <div>
      <div className="font-bold text-md text-blue-300">{location.name}</div>
      <div className="text-xs text-gray-400">{location.subType}</div>
    </div>
    <div className="text-xl font-mono bg-gray-800 text-white px-3 py-1 rounded-md">{location.iataCode}</div>
  </div>
);

const SortButton: React.FC<{ onClick: () => void; isActive: boolean; children: React.ReactNode }> = ({ onClick, isActive, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-sm rounded-full transition-colors duration-200 ${
      isActive
        ? 'bg-blue-600 text-white font-semibold'
        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
    }`}
  >
    {children}
  </button>
);

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;
  const isSystem = message.role === MessageRole.SYSTEM;

  const isFlightMessage = Array.isArray(message.content) && message.content.length > 0 && 'itineraries' in message.content[0];
  const isLocationMessage = Array.isArray(message.content) && message.content.length > 0 && 'iataCode' in message.content[0];

  const [sortBy, setSortBy] = useState<'best' | 'cheapest' | 'fastest'>('best');

  // Reset sort when a new flight message is received
  useEffect(() => {
    if (isFlightMessage) {
      setSortBy('best');
    }
  }, [message.content, isFlightMessage]);

  const sortedFlightOffers = useMemo(() => {
    if (!isFlightMessage) return [];
    
    const offersToSort = [...(message.content as FlightOffer[])];
    
    switch (sortBy) {
      case 'cheapest':
        offersToSort.sort((a, b) => a.price - b.price);
        break;
      case 'fastest':
        offersToSort.sort((a, b) => totalDuration(a.itineraries) - totalDuration(b.itineraries));
        break;
      case 'best':
      default:
        offersToSort.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        break;
    }
    return offersToSort;
  }, [message.content, sortBy, isFlightMessage]);


  const renderContent = () => {
    if (isFlightMessage) {
      return (
        <div>
          <div className="flex items-center gap-2 mb-2 border-b border-gray-600 pb-2">
            <span className="text-sm font-medium text-gray-300">Sort by:</span>
            <SortButton onClick={() => setSortBy('best')} isActive={sortBy === 'best'}>Best</SortButton>
            <SortButton onClick={() => setSortBy('cheapest')} isActive={sortBy === 'cheapest'}>Cheapest</SortButton>
            <SortButton onClick={() => setSortBy('fastest')} isActive={sortBy === 'fastest'}>Fastest</SortButton>
          </div>
          {sortedFlightOffers.map(offer => <FlightOfferCard key={offer.id} flightOffer={offer} />)}
        </div>
      );
    }
    if (isLocationMessage) {
      return (message.content as Location[]).map(loc => <LocationCard key={loc.iataCode} location={loc} />);
    }
    return <p className="whitespace-pre-wrap">{message.content as string}</p>;
  };

  if (isSystem) {
    if (typeof message.content !== 'string') {
      return null;
    }
    return (
      <div className="flex justify-center my-2">
        <div className="text-xs text-gray-400 italic bg-gray-800 px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start max-w-2xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
            <BotIcon className="w-5 h-5 text-blue-300" />
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-lg ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-none'
              : 'bg-gray-700 text-gray-200 rounded-bl-none'
          }`}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
