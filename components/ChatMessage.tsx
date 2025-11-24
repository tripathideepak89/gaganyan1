import React, { useState, useEffect, useMemo } from 'react';
import { ChatMessage as Message, MessageRole, FlightOffer, Location, FlightSegment, Itinerary, HotelOffer } from '../types';
import { BotIcon, PlaneIcon, BuildingOfficeIcon, StarIcon } from './IconComponents';

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

const HotelOfferCard: React.FC<{ hotelOffer: HotelOffer }> = ({ hotelOffer }) => {
  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <StarIcon
            key={i}
            className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-500'}`}
          />
        ))}
      </div>
    );
  };
  
  const fullAddress = [
    ...hotelOffer.address.lines, 
    hotelOffer.address.cityName, 
    hotelOffer.address.postalCode
  ].filter(Boolean).join(', ');

  return (
    <div className="bg-gray-700 rounded-lg shadow-md p-4 mt-3 max-w-lg border border-gray-600">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-lg text-blue-300">{hotelOffer.name}</h3>
          {renderStars(hotelOffer.rating)}
          <p className="text-xs text-gray-400 mt-2">{fullAddress}</p>
        </div>
        <div className="text-right ml-4">
            <div className="text-xl font-semibold text-white">${hotelOffer.price.toFixed(2)}</div>
            <div className="text-xs text-gray-400">per night</div>
        </div>
      </div>
       <div className="flex justify-end items-center mt-4 pt-3 border-t border-gray-600">
        <a 
          href={hotelOffer.bookingUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
        >
          Book Now
        </a>
      </div>
    </div>
  );
};


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
  const isHotelMessage = Array.isArray(message.content) && message.content.length > 0 && 'hotelId' in message.content[0];


  const [sortBy, setSortBy] = useState<'best' | 'cheapest' | 'fastest'>('best');
  const [hotelSortBy, setHotelSortBy] = useState<'recommended' | 'priceLowHigh' | 'priceHighLow'>('recommended');
  const [showAllFlights, setShowAllFlights] = useState(false);
  const [showAllHotels, setShowAllHotels] = useState(false);


  // Reset sort when a new flight message is received
  useEffect(() => {
    if (isFlightMessage) {
      setSortBy('best');
      setShowAllFlights(false);
    }
  }, [message.content, isFlightMessage]);

  // Reset sort when a new hotel message is received
  useEffect(() => {
    if (isHotelMessage) {
      setHotelSortBy('recommended');
      setShowAllHotels(false);
    }
  }, [message.content, isHotelMessage]);

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
  
  const sortedHotelOffers = useMemo(() => {
    if (!isHotelMessage) return [];
    
    const offersToSort = [...(message.content as HotelOffer[])];
    
    switch (hotelSortBy) {
      case 'priceLowHigh':
        offersToSort.sort((a, b) => a.price - b.price);
        break;
      case 'priceHighLow':
        offersToSort.sort((a, b) => b.price - a.price);
        break;
      case 'recommended':
      default:
        offersToSort.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        break;
    }
    return offersToSort;
  }, [message.content, hotelSortBy, isHotelMessage]);


  const renderContent = () => {
    if (isFlightMessage) {
      const offers = message.content as FlightOffer[];
      const visibleOffers = showAllFlights ? sortedFlightOffers : sortedFlightOffers.slice(0, 5);
      return (
        <div>
          <div className="flex items-center gap-2 mb-2 border-b border-gray-600 pb-2">
            <span className="text-sm font-medium text-gray-300">Sort by:</span>
            <SortButton onClick={() => setSortBy('best')} isActive={sortBy === 'best'}>Best</SortButton>
            <SortButton onClick={() => setSortBy('cheapest')} isActive={sortBy === 'cheapest'}>Cheapest</SortButton>
            <SortButton onClick={() => setSortBy('fastest')} isActive={sortBy === 'fastest'}>Fastest</SortButton>
          </div>
          {visibleOffers.map(offer => <FlightOfferCard key={offer.id} flightOffer={offer} />)}
          {offers.length > 5 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setShowAllFlights(!showAllFlights)}
                className="text-blue-400 hover:underline text-sm font-semibold focus:outline-none"
              >
                {showAllFlights ? 'Show Less' : `Show ${offers.length - 5} More`}
              </button>
            </div>
          )}
        </div>
      );
    }
    if (isLocationMessage) {
      return (message.content as Location[]).map(loc => <LocationCard key={loc.iataCode} location={loc} />);
    }
    if (isHotelMessage) {
      const offers = message.content as HotelOffer[];
      const visibleOffers = showAllHotels ? sortedHotelOffers : sortedHotelOffers.slice(0, 5);
      return (
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-2 border-b border-gray-600 pb-2">
            <span className="text-sm font-medium text-gray-300">Sort by:</span>
            <SortButton onClick={() => setHotelSortBy('recommended')} isActive={hotelSortBy === 'recommended'}>Recommended</SortButton>
            <SortButton onClick={() => setHotelSortBy('priceLowHigh')} isActive={hotelSortBy === 'priceLowHigh'}>Price (Low-High)</SortButton>
            <SortButton onClick={() => setHotelSortBy('priceHighLow')} isActive={hotelSortBy === 'priceHighLow'}>Price (High-Low)</SortButton>
          </div>
          {visibleOffers.map(offer => <HotelOfferCard key={offer.hotelId} hotelOffer={offer} />)}
          {offers.length > 5 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setShowAllHotels(!showAllHotels)}
                className="text-blue-400 hover:underline text-sm font-semibold focus:outline-none"
              >
                {showAllHotels ? 'Show Less' : `Show ${offers.length - 5} More`}
              </button>
            </div>
          )}
        </div>
      );
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