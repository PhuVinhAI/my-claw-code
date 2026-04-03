// MessageList Component
import { useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import { renderToolBlock, ThinkingBlock } from '../blocks';
import { parseThinkingTags } from '../../lib/parseThinking';
import { MarkdownContent } from '../../components/MarkdownContent';

function fixIncompleteCodeBlocks(text: string): string {
  const openingCount = (text.match(/^```/gm) || []).length;
  if (openingCount % 2 === 1) return text + '\n```';
  return text;
}

export function MessageList() {
  const { messages, currentAssistantText, state } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const lastMessageCount = useRef(messages.length);

  // Find scroll parent
  const getScrollParent = useCallback(() => {
    return bottomRef.current?.closest('.chat-scroll-container') as HTMLElement | null;
  }, []);

  // Detect REAL user scroll (ignore programmatic)
  useEffect(() => {
    const el = getScrollParent();
    if (!el) return;

    const onScroll = () => {
      // Skip if this scroll was caused by our scrollTo
      if (isProgrammaticScroll.current) return;

      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom > 80) {
        userScrolledUp.current = true;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollParent]);

  // Auto-scroll (only when user hasn't scrolled up)
  useEffect(() => {
    if (userScrolledUp.current) return;

    const el = getScrollParent();
    if (!el) return;

    isProgrammaticScroll.current = true;

    // New message → instant, streaming → smooth
    const isNewMessage = messages.length > lastMessageCount.current;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isNewMessage ? 'instant' : 'smooth',
    });

    // Clear programmatic flag after scroll settles
    requestAnimationFrame(() => {
      setTimeout(() => { isProgrammaticScroll.current = false; }, 100);
    });
  }, [messages.length, currentAssistantText, state.status, getScrollParent]);

  // Reset scroll lock ONLY when user sends a new message
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      userScrolledUp.current = false;
    }
    lastMessageCount.current = messages.length;
  }, [messages.length]);

  return (
    <div className="flex-1 p-6 pb-4">
      <div className="max-w-3xl mx-auto space-y-6">
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
                'text-base leading-[1.8]',
                message.role === 'user'
                  ? 'max-w-md lg:max-max-lg rounded-2xl bg-secondary text-secondary-foreground px-6 py-3.5'
                  : 'w-full'
              )}
            >
              <div className="space-y-4">
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

        {/* Streaming text */}
        {currentAssistantText && (
          <div className="flex w-full items-start justify-start mt-8">
            <div className="w-full text-base leading-[1.8]">
              {(() => {
                const parsed = parseThinkingTags(currentAssistantText);
                return (
                  <div className="space-y-4">
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

        {/* Loading */}
        {state.status === 'GENERATING' && !currentAssistantText && (
          <div className="flex w-full items-start justify-start mt-8">
            <div className="flex items-center gap-3 text-muted-foreground py-3">
              <div className="flex gap-1.5">
                <span className="animate-bounce text-sm" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce text-sm" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce text-sm" style={{ animationDelay: '300ms' }}>●</span>
              </div>
              <span className="text-sm font-medium">Đang suy nghĩ...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
}
