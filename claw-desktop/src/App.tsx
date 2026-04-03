import { useEffect, useState } from 'react';
import { initializeChatStore, useChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList } from './ui/features';
import { Button } from './components/ui/button';
import { Menu, X } from 'lucide-react';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messages = useChatStore((s) => s.messages);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    // Initialize chat store listeners
    initializeChatStore();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-80' : 'w-0'}
          overflow-hidden
        `}
      >
        <SessionList />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 p-2 border-b border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <h1 className="text-lg font-semibold text-foreground/80">Claw Desktop</h1>
        </div>

        {/* Chat Area */}
        {isEmpty ? (
          /* Empty: ChatInput renders its own centered layout */
          <ChatInput />
        ) : (
          /* Active: scrollable with sticky input */
          <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
            <MessageList />
            <ChatInput />
          </div>
        )}
      </div>

      <PermissionModal />
    </div>
  );
}

export default App;
