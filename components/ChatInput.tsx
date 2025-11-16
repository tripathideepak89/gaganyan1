
import React, { useState } from 'react';
import { PaperAirplaneIcon } from './IconComponents';
import SuggestionChips from './SuggestionChips';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  showSuggestions: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, showSuggestions }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="bg-gray-800 p-4">
      {showSuggestions && !isLoading && <SuggestionChips onSendSuggestion={onSendMessage} />}
      <form
        onSubmit={handleSubmit}
        className="flex items-center space-x-4 max-w-4xl mx-auto"
      >
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit(e);
              }
            }}
            placeholder="Ask about flights, e.g., 'Find flights from SFO to JFK tomorrow'"
            className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg p-3 pr-12 resize-none border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
            rows={1}
            disabled={isLoading}
            style={{ maxHeight: '150px' }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <PaperAirplaneIcon className="h-6 w-6" />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;