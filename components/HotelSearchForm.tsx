
import React from 'react';
import { BuildingOfficeIcon } from './IconComponents';
import HotelAutocomplete from './HotelAutocomplete';

interface HotelSearchFormProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
    destination: string;
    setDestination: (value: string) => void;
    checkIn: string;
    setCheckIn: (value: string) => void;
    checkOut: string;
    setCheckOut: (value: string) => void;
    guests: number;
    setGuests: (value: number) => void;
}

const HotelSearchForm: React.FC<HotelSearchFormProps> = ({ 
    onSearch, 
    isLoading,
    destination,
    setDestination,
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    guests,
    setGuests
}) => {
    
    const getTodayString = () => new Date().toISOString().split('T')[0];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const query = `Find hotels in ${destination} from ${checkIn} to ${checkOut} for ${guests} ${guests > 1 ? 'adults' : 'adult'}`;
        onSearch(query);
    };

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-900 travel-pattern">
            <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded-lg border border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <HotelAutocomplete 
                            label="Where do you want to go?"
                            value={destination}
                            onChange={setDestination}
                            placeholder="Country, city or hotel name"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="checkin" className="block text-sm font-medium text-gray-300">Check-in</label>
                            <input type="date" id="checkin" value={checkIn} min={getTodayString()} onChange={e => setCheckIn(e.target.value)} required className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200" />
                        </div>
                        <div>
                            <label htmlFor="checkout" className="block text-sm font-medium text-gray-300">Check-out</label>
                            <input type="date" id="checkout" value={checkOut} min={checkIn || getTodayString()} onChange={e => setCheckOut(e.target.value)} required className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200" />
                        </div>
                        <div>
                            <label htmlFor="guests" className="block text-sm font-medium text-gray-300">Guests</label>
                            <input type="number" id="guests" value={guests} min="1" onChange={e => setGuests(parseInt(e.target.value, 10))} required className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200" />
                        </div>
                    </div>

                    <div className="pt-4 text-right">
                        <button type="submit" disabled={isLoading} className="inline-flex items-center justify-center bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200">
                           <BuildingOfficeIcon className="h-5 w-5 mr-2" />
                            Search Hotels
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HotelSearchForm;
