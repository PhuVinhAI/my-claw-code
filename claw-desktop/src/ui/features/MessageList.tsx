// MessageList Component - Virtualized with Pretext
import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import { renderToolBlock, ThinkingBlock } from '../blocks';
import { parseThinkingTags, cleanSystemReminders } from '../../lib/parseThinking';
import { MarkdownContent } from '../../components/MarkdownContent';
import { useTextMeasurement } from '../../lib/useTextMeasurement';

function fixIncompleteCodeBlocks(text: string): string {
  const openingCount = (text.match(/^```/gm) || []).length;
  if (openingCount % 2 === 1) return text + '\n```';
  return text;
}

export function MessageList() {
  const { t } = useTranslation();
  const { messages, currentAssistantText, state } = useChatStore();
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const lastMessageCount = useRef(messages.length);
  const [containerWidth, setContainerWidth] = useState(0);

  const { measureText } = useTextMeasurement({
    font: '16px Inter',
    whiteSpace: 'normal',
  });

  useEffect(() => {
    const updateWidth = () => {
      if (scrollParentRef.current) {
        const maxW = Math.min(scrollParentRef.current.offsetWidth - 48, 768);
        setContainerWidth(maxW);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (scrollParentRef.current) {
      resizeObserver.observe(scrollParentRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const estimateSize = useCallback(
    (index: number) => {
      if (!containerWidth) return 200;

      const message = messages[index];
      if (!message) return 200;

      let totalHeight = 24;

      message.blocks.forEach((block) => {
        if (block.type === 'text' && block.text) {
          const { height } = measureText(block.text, containerWidth * 0.9, 28.8);
          totalHeight += height + 16;
        } else if (block.type === 'thinking') {
          totalHeight += 80;
        } else if (block.type === 'tool_use') {
          totalHeight += 120;
        }
      });

      return Math.max(totalHeight, 60);
    },
    [messages, containerWidth, measureText]
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize,
    overscan: 3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const el = scrollParentRef.current;
    if (!el) return;

    const onScroll = () => {
      if (isProgrammaticScroll.current) return;

      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom > 80) {
        userScrolledUp.current = true;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (userScrolledUp.current) return;

    const el = scrollParentRef.current;
    if (!el) return;

    isProgrammaticScroll.current = true;

    const isNewMessage = messages.length > lastMessageCount.current;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isNewMessage ? 'instant' : 'smooth',
    });

    requestAnimationFrame(() => {
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
    });
  }, [messages.length, currentAssistantText, state.status]);

  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      userScrolledUp.current = false;
    }
    lastMessageCount.current = messages.length;
  }, [messages.length]);

  return (
    <div ref={scrollParentRef} className="flex-1 p-4 sm:p-5 lg:p-6 pb-3 sm:pb-4 overflow-y-auto">
      <div className="max-w-2xl lg:max-w-3xl mx-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="pb-4 sm:pb-5 lg:pb-6"
              >
                <div
                  className={cn(
                    'flex w-full items-start',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'text-sm sm:text-base leading-[1.7] sm:leading-[1.8]',
                      message.role === 'user'
                        ? 'max-w-[85%] sm:max-w-md lg:max-w-lg rounded-xl sm:rounded-2xl bg-secondary text-secondary-foreground px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5'
                        : 'w-full'
                    )}
                  >
                    <div className="space-y-3 sm:space-y-4">
                      {message.blocks.map((block, blockIdx) => {
                        if (block.type === 'text') {
                          return (
                            <div key={blockIdx}>
                              <MarkdownContent content={cleanSystemReminders(block.text || '')} />
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
              </div>
            );
          })}
        </div>

        {/* Streaming text */}
        {currentAssistantText && (
          <div className="flex w-full items-start justify-start mt-6 sm:mt-7 lg:mt-8">
            <div className="w-full text-sm sm:text-base leading-[1.7] sm:leading-[1.8]">
              {(() => {
                const parsed = parseThinkingTags(currentAssistantText);
                return (
                  <div className="space-y-3 sm:space-y-4">
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
                            <MarkdownContent content={fixIncompleteCodeBlocks(cleanSystemReminders(block.content))} />
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
          <div className="flex w-full items-start justify-start mt-6 sm:mt-7 lg:mt-8">
            <div className="flex items-center gap-2 sm:gap-3 text-muted-foreground py-2 sm:py-3">
              <div className="flex gap-1 sm:gap-1.5">
                <span className="animate-bounce text-xs sm:text-sm" style={{ animationDelay: '0ms' }}>
                  ●
                </span>
                <span className="animate-bounce text-xs sm:text-sm" style={{ animationDelay: '150ms' }}>
                  ●
                </span>
                <span className="animate-bounce text-xs sm:text-sm" style={{ animationDelay: '300ms' }}>
                  ●
                </span>
              </div>
              <span className="text-xs sm:text-sm font-medium">{t('messageList.thinking')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
