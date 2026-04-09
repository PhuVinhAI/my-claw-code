import { useEffect, useState } from 'react';
import { initializeChatStore, useChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList, ErrorBanner } from './ui/features';
import { OnboardingScreen } from './ui/pages/OnboardingScreen';
import { SettingsScreen } from './ui/pages/SettingsScreen';
import { TitleBar } from './components/TitleBar';
import { ResizablePanel } from './components/ResizablePanel';
import { TerminalPanel } from './ui/features/terminal/TerminalPanel';
import { useTerminalStore } from './store/useTerminalStore';
import { PanelLeft, PanelRight, Terminal as TerminalIcon } from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import './App.css';

type Screen = 'chat' | 'settings' | 'onboarding';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const messages = useChatStore((s) => s.messages);
  const isEmpty = messages.length === 0;
  
  // Terminal panel state
  const isPanelOpen = useTerminalStore((state) => state.isPanelOpen);
  const togglePanel = useTerminalStore((state) => state.togglePanel);
  const createTab = useTerminalStore((state) => state.createTab);

  useEffect(() => {
    // Check onboarding status
    const checkOnboarding = async () => {
      try {
        const isComplete = await invoke<boolean>('check_onboarding_complete');
        if (isComplete) {
          setCurrentScreen('chat');
          initializeChatStore();
        } else {
          setCurrentScreen('onboarding');
        }
      } catch (error) {
        console.error('Failed to check onboarding:', error);
        setCurrentScreen('onboarding');
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  const handleOnboardingComplete = () => {
    setCurrentScreen('chat');
    initializeChatStore();
  };

  if (isCheckingOnboarding) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-xs sm:text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (currentScreen === 'onboarding') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <TitleBar />
        <div className="flex-1 min-h-0">
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  if (currentScreen === 'settings') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <TitleBar />
        <div className="flex-1 min-h-0">
          <SettingsScreen onBack={() => setCurrentScreen('chat')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 min-h-0 relative">
      {/* Sidebar */}
      <ResizablePanel
        isOpen={sidebarOpen}
        defaultWidth={240}
        minWidth={200}
        maxWidth={400}
        storageKey="sidebarWidth"
        side="left"
        className="border-r border-border bg-sidebar"
      >
        <SessionList 
          onOpenSettings={() => setCurrentScreen('settings')} 
          onCloseSidebar={() => setSidebarOpen(false)} 
        />
      </ResizablePanel>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Floating Sidebar Toggle when closed */}
        {!sidebarOpen && (
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
              title="Mở Sidebar"
            >
              <PanelLeft className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          </div>
        )}

        {/* Floating Terminal Toggle when closed */}
        {!isPanelOpen && (
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => {
                togglePanel();
                // Create first terminal if none exists
                const tabs = useTerminalStore.getState().tabs;
                if (tabs.length === 0) {
                  createTab();
                }
              }}
              className="flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
              title="Mở Terminal"
            >
              <TerminalIcon className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          </div>
        )}

        {/* Chat Area */}
        {isEmpty ? (
          <ChatInput />
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <MessageList />
            <ChatInput />
          </div>
        )}
      </div>

      {/* Right Terminal Panel */}
      <ResizablePanel
        isOpen={isPanelOpen}
        defaultWidth={500}
        minWidth={300}
        maxWidth={800}
        storageKey="terminalPanelWidth"
        side="right"
        className="border-l border-border bg-background"
      >
        <div className="flex flex-col h-full">
          {/* Terminal Panel Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Terminal</span>
            </div>
            <button
              onClick={togglePanel}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Đóng Terminal"
            >
              <PanelRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          
          {/* Terminal Content */}
          <div className="flex-1 min-h-0">
            <TerminalPanel />
          </div>
        </div>
      </ResizablePanel>

      <PermissionModal />
      <ErrorBanner />
      </div>
    </div>
  );
}

export default App;
