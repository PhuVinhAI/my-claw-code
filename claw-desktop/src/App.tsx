import { useEffect, useState } from 'react';
import { initializeChatStore, useChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList } from './ui/features';
import { OnboardingScreen } from './ui/pages/OnboardingScreen';
import { SettingsScreen } from './ui/pages/SettingsScreen';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className={`
          shrink-0 transition-all duration-300 ease-in-out border-r border-border
          ${sidebarOpen ? 'w-64 sm:w-72 lg:w-80' : 'w-0'}
          overflow-hidden
        `}
      >
        <SessionList onOpenSettings={() => setCurrentScreen('settings')} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4 shrink-0 border-b border-border/50">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5" /> : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <span className="text-sm sm:text-base font-semibold text-foreground">Claw</span>
          </div>
        </div>

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
    </div>
  );
}

export default App;
