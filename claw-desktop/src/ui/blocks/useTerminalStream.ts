// Custom hook to stream terminal output directly to xterm
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { listen } from '@tauri-apps/api/event';
import { StreamEvent } from '../../core/entities';

export function useTerminalStream(
  terminal: Terminal | null, 
  toolUseId: string | undefined,
  shouldListen: boolean = true
) {
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!terminal || !toolUseId || !shouldListen) return;

    // Subscribe to stream events directly
    listen<StreamEvent>('stream_event', (event) => {
      const streamEvent = event.payload;
      
      // Only handle tool_output_chunk for this specific tool
      if (streamEvent.type === 'tool_output_chunk' && streamEvent.tool_use_id === toolUseId) {
        // Write chunk directly to terminal (preserves all formatting)
        terminal.write(streamEvent.chunk);
      }
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [terminal, toolUseId, shouldListen]);
}
