import React from 'react';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import { ChatMessage as Message } from '../types';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onCredentialsSaved: () => void;
  onSendMessage: (message: string) => void;
  areCredentialsSet: boolean;
  showSuggestions: boolean;
}

const ChatView: React.FC<ChatViewProps> = (props) => {
  return (
    <div className="flex flex-col h-full bg-gray-900 travel-pattern">
      <ChatWindow
        messages={props.messages}
        isLoading={props.isLoading}
        onCredentialsSaved={props.onCredentialsSaved}
      />
      <ChatInput
        onSendMessage={props.onSendMessage}
        isLoading={props.isLoading || !props.areCredentialsSet}
        showSuggestions={props.showSuggestions}
      />
    </div>
  );
};

export default ChatView;