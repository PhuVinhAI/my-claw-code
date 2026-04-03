// MessageList Component
import { useRef, useEffect } from 'react';
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import { renderToolBlock, ThinkingBlock } from '../blocks';
import { parseThinkingTags } from '../../lib/parseThinking';
import { MarkdownContent } from '../../components/MarkdownContent';

// Helper: Tạm đóng code blocks chưa hoàn chỉnh khi streaming
function fixIncompleteCodeBlocks(text: string): string {
  const openingCount = (text.match(/^```/gm) || []).length;
  if (openingCount % 2 === 1) {
    return text + '\n```';
  }
  return text;
}

export function MessageList() {
  const { messages, currentAssistantText, state } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, [messages.length, currentAssistantText, state.status]);

  return (
    <div className="flex-1 p-5 pb-2">
      <div className="max-w-3xl mx-auto space-y-5">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={cn(
              'flex w-full items-start',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'text-[14px] leading-relaxed',
                message.role === 'user'
                  ? 'max-w-xs md:max-w-md lg:max-w-lg rounded-2xl bg-muted/60 px-4 py-2.5'
                  : 'w-full'
              )}
            >
              <div className="space-y-3">
                {message.blocks.map((block, blockIdx) => {
                  if (block.type === 'text') {
                    return (
                      <div key={blockIdx}>
                        <MarkdownContent content={block.text || ''} />
                      </div>
                    );
                  }
                  if (block.type === 'thinking') {
                    return (
                      <ThinkingBlock
                        key={blockIdx}
                        thinking={block.thinking || ''}
                        isStreaming={block.isStreaming}
                      />
                    );
                  }
                  if (block.type === 'tool_use') {
                    const toolResult = message.blocks.find(
                      (b) => b.type === 'tool_result' && b.tool_use_id === block.id
                    );
                    return (
                      <div key={blockIdx}>
                        {renderToolBlock({
                          toolUseBlock: block,
                          toolResultBlock: toolResult,
                        })}
                      </div>
                    );
                  }
                  if (block.type === 'tool_result') return null;
                  return null;
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Current streaming text */}
        {currentAssistantText && (
          <div className="flex w-full items-start justify-start">
            <div className="w-full text-[14px] leading-relaxed">
              {(() => {
                const parsed = parseThinkingTags(currentAssistantText);
                return (
                  <div className="space-y-3">
                    {parsed.blocks.map((block, idx) => {
                      if (block.type === 'thinking') {
                        return (
                          <ThinkingBlock
                            key={idx}
                            thinking={block.content}
                            isStreaming={!block.isComplete}
                          />
                        );
                      } else {
                        return (
                          <div key={idx}>
                            <MarkdownContent content={fixIncompleteCodeBlocks(block.content)} />
                          </div>
                        );
                      }
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {state.status === 'GENERATING' && !currentAssistantText && (
          <div className="flex w-full items-start justify-start">
            <div className="flex items-center gap-2.5 text-muted-foreground/60 py-2">
              <div className="flex gap-1">
                <span className="animate-bounce text-xs" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce text-xs" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce text-xs" style={{ animationDelay: '300ms' }}>●</span>
              </div>
              <span className="text-xs">Đang suy nghĩ...</span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
}
