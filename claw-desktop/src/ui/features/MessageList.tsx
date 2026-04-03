// MessageList Component - Virtualized with Pretext
import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import { renderToolBlock, ThinkingBlock } from '../blocks';
import { parseThinkingTags } from '../../lib/parseThinking';
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

  // Pretext measurement
  const { measureText } = useTextMeasurement({
    font: '16px Inter',
    whiteSpace: 'normal',
  });

  // Track container width
  useEffect(() => {
    const updateWidth = () => {
      if (scrollParentRef.current) {
        const maxW = Math.min(scrollParentRef.current.offsetWidth - 48, 768); // max-w-3xl = 768px
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

  // Estimate message heights với Pretext
  const estimateSize = useCallback(
    (index: number) => {
      if (!containerWidth) return 200; // fallback

      const message = messages[index];
      if (!message) return 200;

      let totalHeight = 24; // base padding

      // Estimate từng block
      message.blocks.forEach((block) => {
        if (block.type === 'text' && block.text) {
          const { height } = measureText(block.text, containerWidth * 0.9, 28.8);
          totalHeight += height + 16; // spacing
        } else if (block.type === 'thinking') {
          totalHeight += 80; // collapsed thinking block
        } else if (block.type === 'tool_use') {
          totalHeight += 120; // tool block estimate
        }
      });

      return Math.max(totalHeight, 60);
    },
    [messages, containerWidth, measureText]
  );

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize,
    overscan: 3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Detect user scroll
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

  // Auto-scroll to bottom
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

  // Reset scroll lock on new message
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      userScrolledUp.current = false;
    }
    lastMessageCount.current = messages.length;
  }, [messages.length]);

  return (
    <div ref={scrollParentRef} className="flex-1 p-6 pb-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        {/* Virtual list */}
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
                className="pb-6"
              >
                <div
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
              </div>
            );
          })}
        </div>

        {/* Streaming text - always visible at bottom */}
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
                <span className="animate-bounce text-sm" style={{ animationDelay: '0ms' }}>
                  ●
                </span>
                <span className="animate-bounce text-sm" style={{ animationDelay: '150ms' }}>
                  ●
                </span>
                <span className="animate-bounce text-sm" style={{ animationDelay: '300ms' }}>
                  ●
                </span>
              </div>
              <span className="text-sm font-medium">{t('messageList.thinking')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
