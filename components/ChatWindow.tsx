
import React, { useEffect, useRef } from 'react';
import { ChatMessage as Message } from '../types';
import ChatMessage from './ChatMessage';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="max-w-4xl mx-auto">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
            <div className="flex items-start my-4 justify-start">
              <div className="flex items-start max-w-2xl flex-row">
                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                    {/* Bot Icon can be placed here */}
                 </div>
                 <div className="px-4 py-3 rounded-lg bg-gray-700 text-gray-200 rounded-bl-none">
                     <div className="flex items-center justify-center space-x-1">
                        <span className="text-gray-400">Thinking</span>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
                    </div>
                </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
