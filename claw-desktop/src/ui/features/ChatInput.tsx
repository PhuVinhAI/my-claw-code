// ChatInput Component
import { useState } from 'react';
import { useChatStore } from '../../store';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Send, Square, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ChatInput() {
  const [input, setInput] = useState('');
  const { state, sendPrompt, stopGeneration, model } = useChatStore();
  const isGenerating = state.status !== 'IDLE';

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const currentInput = input;
    setInput(''); // Xóa text ngay lập tức khi gửi
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

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-4xl mx-auto flex flex-col rounded-xl border bg-background focus-within:ring-1 focus-within:ring-ring overflow-hidden shadow-sm transition-all">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập yêu cầu của bạn..."
          className="min-h-[60px] max-h-[200px] w-full resize-none border-none bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
          rows={1}
          // Cố tình KHÔNG disable textarea khi đang generating để user có thể nhập tiếp nếu muốn
        />

        <div className="flex h-12 items-center justify-between px-3 pb-2 pt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
              <Bot className="h-4 w-4" />
              <span className="font-medium">{model}</span>
            </Button>
          </div>

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
