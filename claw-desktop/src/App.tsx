import { useEffect, useState } from 'react';
import { initializeChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList } from './ui/features';
import { Button } from './components/ui/button';
import { Menu, X } from 'lucide-react';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
        <div className="flex items-center gap-2 p-2 border-b border-gray-200 bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <h1 className="text-lg font-semibold text-gray-800">Claw Desktop</h1>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <MessageList />
          <ChatInput />
        </div>
      </div>

      <PermissionModal />
    </div>
  );
}

export default App;
