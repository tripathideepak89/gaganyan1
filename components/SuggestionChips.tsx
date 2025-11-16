import React from 'react';

interface SuggestionChipsProps {
  onSendSuggestion: (suggestion: string) => void;
}

const suggestions = [
  "Find flights from SFO to JFK tomorrow",
  "Hotels in London for next weekend for 2 adults",
  "One way flight from Delhi to Mumbai on Dec 25th",
];

const SuggestionChip: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <button
    onClick={onClick}
    className="bg-gray-700 text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-600 hover:bg-gray-600 hover:border-blue-500 transition-all duration-200 whitespace-nowrap"
  >
    {text}
  </button>
);

const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSendSuggestion }) => {
  return (
    <div className="max-w-4xl mx-auto mb-3">
        <p className="text-sm text-gray-400 mb-2 px-1">Try asking:</p>
        <div className="flex flex-wrap items-center gap-2">
        {suggestions.map((text) => (
            <SuggestionChip
            key={text}
            text={text}
            onClick={() => onSendSuggestion(text)}
            />
        ))}
        </div>
    </div>
  );
};

export default SuggestionChips;
