
import React from 'react';
import { PaperAirplaneIcon } from './IconComponents';
import AirportAutocomplete from './AirportAutocomplete';

interface FlightSearchFormProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
    tripType: 'roundtrip' | 'oneway';
    setTripType: (value: 'roundtrip' | 'oneway') => void;
    from: string;
    setFrom: (value: string) => void;
    to: string;
    setTo: (value: string) => void;
    depart: string;
    setDepart: (value: string) => void;
    returnDate: string;
    setReturnDate: (value: string) => void;
    adults: number;
    setAdults: (value: number) => void;
    childrenCount: number;
    setChildrenCount: (value: number) => void;
    childAges: number[];
    setChildAges: (ages: number[]) => void;
}

const FlightSearchForm: React.FC<FlightSearchFormProps> = ({ 
    onSearch, 
    isLoading,
    tripType,
    setTripType,
    from,
    setFrom,
    to,
    setTo,
    depart,
    setDepart,
    returnDate,
    setReturnDate,
    adults,
    setAdults,
    childrenCount,
    setChildrenCount,
    childAges,
    setChildAges
}) => {

    const getTodayString = () => new Date().toISOString().split('T')[0];
    
    const handleChildrenCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const count = parseInt(e.target.value, 10) || 0;
        if (count < 0) return;
        setChildrenCount(count);

        const newAges = [...childAges];
        newAges.length = count;
        for (let i = 0; i < count; i++) {
            if (newAges[i] === undefined || newAges[i] === null) {
                newAges[i] = 6; // Default age
            }
        }
        setChildAges(newAges);
    };

    const handleChildAgeChange = (index: number, age: number) => {
        const newAges = [...childAges];
        newAges[index] = age;
        setChildAges(newAges);
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let query = `Find a ${tripType === 'oneway' ? 'one way' : 'round trip'} flight from ${from} to ${to} for ${adults} ${adults > 1 ? 'adults' : 'adult'}`;
        if (childrenCount > 0) {
            const childAgeStr = childAges.map(age => `age ${age}`).join(' and ');
            query += ` and ${childrenCount} ${childrenCount > 1 ? 'children' : 'child'} with ages ${childAgeStr}`;
        }
        if (depart) {
            query += ` departing on ${depart}`;
        }
        if (tripType === 'roundtrip' && returnDate) {
            query += ` returning on ${returnDate}`;
        }
        onSearch(query);
    };

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-900 travel-pattern">
            <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded-lg border border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 text-white">
                            <input type="radio" name="tripType" value="roundtrip" checked={tripType === 'roundtrip'} onChange={() => setTripType('roundtrip')} className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500" />
                            <span>Round-trip</span>
                        </label>
                        <label className="flex items-center space-x-2 text-white">
                            <input type="radio" name="tripType" value="oneway" checked={tripType === 'oneway'} onChange={() => setTripType('oneway')} className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500" />
                            <span>One-way</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <AirportAutocomplete 
                                label="From"
                                value={from}
                                onChange={setFrom}
                                placeholder="City or Airport (e.g. JFK)"
                            />
                        </div>
                        <div>
                            <AirportAutocomplete 
                                label="To"
                                value={to}
                                onChange={setTo}
                                placeholder="City or Airport (e.g. London)"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="depart" className="block text-sm font-medium text-gray-300">Depart</label>
                            <input type="date" id="depart" value={depart} min={getTodayString()} onChange={e => setDepart(e.target.value)} required className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200" />
                        </div>
                        <div>
                            <label htmlFor="return" className="block text-sm font-medium text-gray-300">Return</label>
                            <input type="date" id="return" value={returnDate} min={depart || getTodayString()} onChange={e => setReturnDate(e.target.value)} required={tripType === 'roundtrip'} disabled={tripType === 'oneway'} className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed" />
                        </div>
                    </div>

                    <div>
                        <p className="block text-sm font-medium text-gray-300 mb-2">Travellers</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="adults" className="block text-xs font-medium text-gray-400">Adults (12+)</label>
                                <input type="number" id="adults" value={adults} min="1" onChange={e => setAdults(parseInt(e.target.value, 10))} required className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200" />
                            </div>
                            <div>
                                <label htmlFor="children" className="block text-xs font-medium text-gray-400">Children (2-11)</label>
                                <input type="number" id="children" value={childrenCount} min="0" onChange={handleChildrenCountChange} required className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200" />
                            </div>
                        </div>
                    </div>
                    
                    {childrenCount > 0 && (
                        <div>
                             <label className="block text-sm font-medium text-gray-300">Ages of Children</label>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                                {childAges.map((age, index) => (
                                    <div key={index}>
                                        <label htmlFor={`child-age-${index}`} className="block text-xs font-medium text-gray-400">Child {index + 1} Age</label>
                                        <input
                                            id={`child-age-${index}`}
                                            type="number"
                                            value={age}
                                            min="2"
                                            max="11"
                                            onChange={(e) => handleChildAgeChange(index, parseInt(e.target.value, 10))}
                                            required
                                            className="mt-1 w-full bg-gray-700 text-white rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
                                        />
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    <div className="pt-4 text-right">
                        <button type="submit" disabled={isLoading} className="inline-flex items-center justify-center bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200">
                             <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                            Search Flights
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FlightSearchForm;
