// Custom TitleBar Component
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const appWindow = getCurrentWindow();
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();

    // Listen for resize events
    const unlisten = getCurrentWindow().onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
    const maximized = await appWindow.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  return (
    <div className="h-8 bg-background border-b border-border flex items-center select-none shrink-0">
      {/* Draggable area - Left side with title */}
      <div 
        data-tauri-drag-region
        className="flex-1 h-full flex items-center px-3"
      >
        <span className="text-xs font-semibold text-foreground">Claw</span>
      </div>

      {/* Window Controls - Right side, no gap */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-11 flex items-center justify-center hover:bg-muted transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-11 flex items-center justify-center hover:bg-muted transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <Square className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          onClick={handleClose}
          className="h-full w-11 flex items-center justify-center hover:bg-red-500 transition-colors group"
          title="Close"
        >
          <X className="w-4 h-4 text-muted-foreground group-hover:text-white" />
        </button>
      </div>
    </div>
  );
}
