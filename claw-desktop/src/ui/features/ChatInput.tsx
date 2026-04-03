// ChatInput Component
import { useState } from 'react';
import { useChatStore } from '../../store';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Send, Square, Bot, FolderOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WorkMode, WorkModeLabels } from '../../core/entities/WorkMode';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '../../components/ui/select';
import { invoke } from '@tauri-apps/api/core';

export function ChatInput() {
  const [input, setInput] = useState('');
  const { state, sendPrompt, stopGeneration, model, workMode, workspacePath, setWorkMode } = useChatStore();
  const isGenerating = state.status !== 'IDLE';

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const currentInput = input;
    setInput('');
    await sendPrompt(currentInput);
  };

  const handleStop = () => {
    if (stopGeneration) stopGeneration();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = async (newMode: WorkMode | null) => {
    if (!newMode) return;
    
    if (newMode === 'workspace') {
      try {
        const selectedPath = await invoke<string | null>('select_and_set_workspace');
        if (selectedPath) {
          await setWorkMode('workspace', selectedPath);
        }
      } catch (e) {
        console.error('Failed to select workspace:', e);
        alert(`Không thể chọn workspace: ${e}`);
      }
    } else {
      await setWorkMode('normal');
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-4xl mx-auto flex flex-col rounded-xl border bg-background focus-within:ring-1 focus-within:ring-ring overflow-hidden shadow-sm transition-all">
        
        {/* TRÊN TEXTAREA - Chỉ hiện khi Workspace mode */}
        {workMode === 'workspace' && (
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="truncate" title={workspacePath || ''}>
              {workspacePath || 'Chưa chọn workspace'}
            </span>
          </div>
        )}

        {/* TEXTAREA */}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập yêu cầu của bạn..."
          className="min-h-[60px] max-h-[200px] w-full resize-none border-none bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
          rows={1}
        />

        {/* DƯỚI TEXTAREA - Luôn hiện: Dropdown + Model + Send */}
        <div className="flex h-12 items-center justify-between px-3 pb-2 pt-1">
          <div className="flex items-center gap-2">
            {/* Mode Selector */}
            <Select value={workMode} onValueChange={handleModeChange}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <span>{WorkModeLabels[workMode]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{WorkModeLabels.normal}</SelectItem>
                <SelectItem value="workspace">{WorkModeLabels.workspace}</SelectItem>
              </SelectContent>
            </Select>

            {/* Model Display */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              <span>{model}</span>
            </div>
          </div>

          {/* Send/Stop Button */}
          {isGenerating ? (
            <Button
              onClick={handleStop}
              variant="destructive"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg animate-in fade-in zoom-in duration-200"
              title="Dừng AI"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg transition-all duration-200 animate-in fade-in zoom-in",
                input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
              title="Gửi tin nhắn"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
