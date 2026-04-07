import { useState, useEffect, useRef, ReactNode } from 'react';
import { cn } from '../lib/utils';

interface ResizablePanelProps {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  isOpen: boolean;
  side?: 'left' | 'right';
  className?: string;
  onWidthChange?: (width: number) => void;
}

export function ResizablePanel({
  children,
  defaultWidth = 240,
  minWidth = 200,
  maxWidth = 400,
  storageKey,
  isOpen,
  side = 'left',
  className,
  onWidthChange,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved width from localStorage
  useEffect(() => {
    if (!storageKey) return;
    
    const savedWidth = localStorage.getItem(storageKey);
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10);
      if (parsedWidth >= minWidth && parsedWidth <= maxWidth) {
        setWidth(parsedWidth);
      }
    }
  }, [storageKey, minWidth, maxWidth]);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;

      let newWidth: number;
      
      if (side === 'left') {
        newWidth = e.clientX;
      } else {
        // For right side panel
        newWidth = window.innerWidth - e.clientX;
      }

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
        if (storageKey) {
          localStorage.setItem(storageKey, newWidth.toString());
        }
        if (onWidthChange) {
          onWidthChange(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, minWidth, maxWidth, side, storageKey, onWidthChange]);

  const handlePosition = side === 'left' ? 'right-0' : 'left-0';

  return (
    <div
      ref={panelRef}
      className={cn(
        'shrink-0 overflow-hidden relative',
        className
      )}
      style={{
        width: isOpen ? `${width}px` : '0px',
        transition: isOpen ? 'none' : 'width 300ms ease-in-out',
      }}
    >
      {children}

      {/* Resize Handle */}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            'absolute top-0 w-1 h-full cursor-col-resize z-50',
            'hover:bg-accent/50 transition-colors',
            isResizing && 'bg-accent',
            handlePosition
          )}
        >
          {/* Visual indicator */}
          <div 
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-1 h-12 bg-accent/30 rounded-full',
              'opacity-0 hover:opacity-100 transition-opacity',
              side === 'left' ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
            )}
          />
        </div>
      )}
    </div>
  );
}
