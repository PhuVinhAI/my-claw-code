import { useEffect, useState } from 'react';
import { initializeChatStore, useChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList, ErrorBanner } from './ui/features';
import { OnboardingScreen } from './ui/pages/OnboardingScreen';
import { SettingsScreen } from './ui/pages/SettingsScreen';
import { PanelLeft } from 'lucide-react';

import { invoke } from '@tauri-apps/api/core';
import './App.css';

type Screen = 'chat' | 'settings' | 'onboarding';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const messages = useChatStore((s) => s.messages);
  const isEmpty = messages.length === 0;

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
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (currentScreen === 'settings') {
    return <SettingsScreen onBack={() => setCurrentScreen('chat')} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background relative text-foreground">





      {/* Sidebar */}
      <div
        className={`
          shrink-0 transition-all duration-300 ease-in-out border-r border-border bg-sidebar







          ${sidebarOpen ? 'w-56 sm:w-64' : 'w-0'}

          overflow-hidden
        `}
      >
        <SessionList onOpenSettings={() => setCurrentScreen('settings')} onCloseSidebar={() => setSidebarOpen(false)} />

      </div>

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

      <PermissionModal />
      <ErrorBanner />
    </div>
  );
}

export default App;
