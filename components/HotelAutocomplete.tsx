
import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { HotelDatabaseEntry } from '../types';

interface HotelAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HotelAutocomplete: React.FC<HotelAutocompleteProps> = ({ label, value, onChange, placeholder }) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<HotelDatabaseEntry[]>([]);
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
    const fetchHotels = async () => {
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
          .from('hotels')
          .select('*')
          .or(`hotel_name.ilike.%${query}%,city.ilike.%${query}%,country_name.ilike.%${query}%`)
          .limit(10);

        if (error) {
            console.error('Supabase search error:', error);
            setSuggestions([]);
        } else {
            setSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error searching hotels:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      if (showSuggestions) {
        fetchHotels();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, showSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue); 
    setShowSuggestions(true);
  };

  const handleSelect = (hotel: HotelDatabaseEntry) => {
    const city = hotel.city ? hotel.city.trim() : '';
    const country = hotel.country_name ? hotel.country_name.trim() : '';
    const name = hotel.hotel_name.trim();
    
    // Construct a string that represents the user's choice for the search query
    const parts = [name, city, country].filter(Boolean);
    const formattedValue = parts.join(', ');
    
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
              {suggestions.map((hotel) => (
                <li
                  key={hotel.id}
                  onClick={() => handleSelect(hotel)}
                  className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200 border-b border-gray-700 last:border-0"
                >
                  <div className="font-semibold text-blue-300">
                    {hotel.hotel_name}
                  </div>
                  <div className="text-xs text-gray-400">
                     {[hotel.city, hotel.country_name].filter(Boolean).join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
             <div className="p-3 text-sm text-gray-400">No hotels found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default HotelAutocomplete;
