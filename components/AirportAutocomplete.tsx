
import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { Airport } from '../types';

interface AirportAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const AirportAutocomplete: React.FC<AirportAutocompleteProps> = ({ label, value, onChange, placeholder }) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Airport[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync internal state if external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchAirports = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const supabase = await getSupabase();
        if (!supabase) {
            setSuggestions([]);
            return;
        }

        const { data, error } = await supabase
          .from('airports')
          .select('*')
          // Updated query to use new column names: airport_name, city, country
          .or(`airport_name.ilike.%${query}%,city.ilike.%${query}%,iata_code.ilike.%${query}%,country.ilike.%${query}%`)
          .not('iata_code', 'is', null) // Only want airports with IATA codes
          .limit(10);

        if (error) {
            console.error('Supabase search error:', error);
            // Fallback to empty suggestions if connection fails
            setSuggestions([]);
        } else {
            setSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error searching airports:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      if (showSuggestions) {
        fetchAirports();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, showSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue); // Propagate partial text to parent
    setShowSuggestions(true);
  };

  const handleSelect = (airport: Airport) => {
    // Format: "City, Country (IATA)"
    // Note: trimming because CHAR(n) columns can sometimes have padding in some DBs, though Supabase often trims JSON responses.
    const city = airport.city ? airport.city.trim() : '';
    const country = airport.country ? airport.country.trim() : '';
    const code = airport.iata_code ? airport.iata_code.trim() : '';
    
    const formattedValue = `${city}, ${country} (${code})`;
    setQuery(formattedValue);
    onChange(formattedValue);
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        required
        className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
        autoComplete="off"
      />
      
      {showSuggestions && (query.length >= 2) && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-gray-400">Loading...</div>
          ) : suggestions.length > 0 ? (
            <ul>
              {suggestions.map((airport) => (
                <li
                  key={airport.id}
                  onClick={() => handleSelect(airport)}
                  className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200 border-b border-gray-700 last:border-0"
                >
                  <div className="font-semibold text-blue-300">
                    {airport.city && airport.city.trim()}, {airport.country && airport.country.trim()} ({airport.iata_code && airport.iata_code.trim()})
                  </div>
                  <div className="text-xs text-gray-400">
                    {airport.airport_name}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
             <div className="p-3 text-sm text-gray-400">No airports found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AirportAutocomplete;
