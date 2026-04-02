import { useEffect, useState } from 'react';
import { initializeChatStore } from './store';
import { MessageList, ChatInput, PermissionModal, SessionList } from './ui/features';
import { Button } from './components/ui/button';
import { Menu, X, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspace, setWorkspace] = useState<string>('');

  useEffect(() => {
    // Initialize chat store listeners
    initializeChatStore();
    
    // Load current working directory
    loadWorkspace();
  }, []);

  const loadWorkspace = async () => {
    try {
      const cwd = await invoke<string>('get_working_directory');
      setWorkspace(cwd);
    } catch (e) {
      console.error('Failed to get working directory:', e);
    }
  };

  const selectWorkspace = async () => {
    try {
      const result = await invoke<string | null>('select_and_set_workspace');
      if (result) {
        setWorkspace(result);
      }
    } catch (e) {
      console.error('Failed to select workspace:', e);
      alert(`Không thể chọn thư mục: ${e}`);
    }
  };

  const getWorkspaceName = () => {
    if (!workspace) return 'Đang tải...';
    const parts = workspace.split(/[/\\]/);
    return parts[parts.length - 1] || workspace;
  };

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
        <div className="flex items-center justify-between gap-2 p-2 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <h1 className="text-lg font-semibold text-gray-800">Claw Desktop</h1>
          </div>

          {/* Workspace Display */}
          <Button
            variant="outline"
            size="sm"
            onClick={selectWorkspace}
            className="flex items-center gap-2"
            title={workspace}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="max-w-xs truncate">{getWorkspaceName()}</span>
          </Button>
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
