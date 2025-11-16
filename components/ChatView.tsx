import React from 'react';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import { ChatMessage as Message } from '../types';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  showSuggestions: boolean;
}

const ChatView: React.FC<ChatViewProps> = (props) => {
  return (
    <div className="flex flex-col h-full bg-gray-900 travel-pattern">
      <ChatWindow
        messages={props.messages}
        isLoading={props.isLoading}
      />
      <ChatInput
        onSendMessage={props.onSendMessage}
        isLoading={props.isLoading}
        showSuggestions={props.showSuggestions}
      />
    </div>
  );
};

export default ChatView;
