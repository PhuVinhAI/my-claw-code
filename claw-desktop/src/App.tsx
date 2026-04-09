import { useEffect, useState } from 'react';
import { initializeChatStore, useChatStore } from './store';
import { MessageList, ChatInput, SessionList, ErrorBanner } from './ui/features';
import { OnboardingScreen } from './ui/pages/OnboardingScreen';
import { SettingsScreen } from './ui/pages/SettingsScreen';
import { TitleBar } from './components/TitleBar';
import { ResizablePanel } from './components/ResizablePanel';
import { RightPanel } from './ui/features/rightpanel/RightPanel';
import { ToastContainer } from './components/ToastContainer';
import { useToastStore } from './store/useToastStore';
import { useRightPanelStore } from './store/useRightPanelStore';
import { useTerminalStore } from './store/useTerminalStore';
import { PanelLeft, PanelRight, Folder, Home as HomeIcon } from 'lucide-react';
import { cn } from './lib/utils';

import { invoke } from '@tauri-apps/api/core';
import './App.css';

type Screen = 'chat' | 'settings' | 'onboarding';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const messages = useChatStore((s) => s.messages);
  const workMode = useChatStore((s) => s.workMode);
  const workspacePath = useChatStore((s) => s.workspacePath);
  const isEmpty = messages.length === 0;
  
  // Right panel state
  const activeTab = useRightPanelStore((state) => state.activeTab);
  const setActiveTab = useRightPanelStore((state) => state.setActiveTab);
  const createTab = useTerminalStore((state) => state.createTab);
  
  // Toast state
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  
  const isPanelOpen = activeTab !== null;
  
  // Auto-close right panel when switching to Home mode
  useEffect(() => {
    if (workMode === 'normal' && isPanelOpen) {
      console.log('[App] Switching to Home mode - closing right panel');
      setActiveTab(null);
    }
  }, [workMode, isPanelOpen, setActiveTab]);

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
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        // Remove right border when no right panel in workspace mode
        workMode === 'normal' && "border-r-0"
      )}>
        {/* Header Bar - Always visible */}
        <div className={cn(
          "h-9 border-b bg-background/95 backdrop-blur-sm flex items-center px-3 gap-3 shrink-0",
          // Only show border when in workspace mode (has right panel)
          workMode === 'workspace' && workspacePath ? "border-border" : "border-transparent"
        )}>
          {/* Left: Sidebar Toggle + Workspace Path (only show path when has messages) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 shrink-0"
                title="Mở Sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            
            {/* Workspace Path - Only show when has messages */}
            {!isEmpty && (
              <div className="flex items-center gap-1.5 min-w-0">
                {workMode === 'workspace' && workspacePath ? (
                  <>
                    <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span 
                      className="text-xs font-medium text-foreground truncate" 
                      title={workspacePath}
                    >
                      {workspacePath}
                    </span>
                  </>
                ) : (
                  <>
                    <HomeIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Home</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Panel Toggle - Only show in workspace mode */}
          {!isPanelOpen && workMode === 'workspace' && workspacePath && (
            <button
              onClick={() => {
                setActiveTab('terminal');
                // Create first terminal if none exists
                const tabs = useTerminalStore.getState().tabs;
                if (tabs.length === 0) {
                  createTab();
                }
              }}
              className="flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 shrink-0"
              title="Mở Panel"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          )}
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

      {/* Right Panel - Only show in workspace mode */}
      {workMode === 'workspace' && workspacePath && (
        <ResizablePanel
          isOpen={isPanelOpen}
          defaultWidth={500}
          minWidth={300}
          maxWidth={800}
          storageKey="rightPanelWidth"
          side="right"
          className="border-l border-border bg-background"
        >
          <div className="flex h-full">
            <RightPanel />
            
            {/* Close Button */}
            <button
              onClick={() => setActiveTab(null)}
              className="absolute top-2 right-2 p-1 hover:bg-accent rounded transition-colors z-10"
              title="Đóng Panel"
            >
              <PanelRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </ResizablePanel>
      )}

      <ErrorBanner />
      <ToastContainer 
        toasts={toasts} 
        onClose={removeToast} 
      />
      </div>
    </div>
  );
}

export default App;
