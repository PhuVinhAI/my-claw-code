// ChatInput Component
import { useState } from 'react';
import { useChatStore } from '../../store';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Send } from 'lucide-react';

export function ChatInput() {
  const [input, setInput] = useState('');
  const { state, sendPrompt } = useChatStore();
  const isDisabled = state.status !== 'IDLE';

  const handleSend = async () => {
    if (!input.trim() || isDisabled) return;
    await sendPrompt(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-4xl mx-auto flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập câu hỏi của bạn..."
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
          disabled={isDisabled}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isDisabled}
          size="icon"
          className="h-[44px] w-[44px] shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
