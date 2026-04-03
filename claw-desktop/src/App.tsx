import { useEffect, useState } from 'react';
import { initializeChatStore, useChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList } from './ui/features';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messages = useChatStore((s) => s.messages);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    initializeChatStore();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className={`
          shrink-0 transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-72' : 'w-0'}
          overflow-hidden
        `}
      >
        <SessionList />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2.5 h-12 px-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-all duration-150"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          <span className="text-sm font-medium text-foreground/60">Claw</span>
        </div>

        {/* Chat Area */}
        {isEmpty ? (
          <ChatInput />
        ) : (
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
