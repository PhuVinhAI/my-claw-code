import { useEffect } from 'react';
import { initializeChatStore } from './store';
import { MessageList, ChatInput, PermissionModal } from './ui/features';
import './App.css';

function App() {
  useEffect(() => {
    // Initialize chat store listeners
    initializeChatStore();
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <MessageList />
      <ChatInput />
      <PermissionModal />
    </div>
  );
}

export default App;
