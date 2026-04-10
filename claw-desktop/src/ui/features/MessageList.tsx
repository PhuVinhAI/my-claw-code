// MessageList Component - Virtualized with Pretext
import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import { renderToolBlock, ThinkingBlock, CompactBlock } from '../blocks';
import { AiThinkingIndicator } from '../../components/ui/ai-thinking-indicator';
import { parseThinkingTags, cleanSystemReminders } from '../../lib/parseThinking';
import { MarkdownContent } from '../../components/MarkdownContent';
import { useTextMeasurement } from '../../lib/useTextMeasurement';
import { ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';
import { MessageFooter } from './MessageFooter';
import { Button } from '../../components/ui/button';

const COLLAPSE_THRESHOLD = 300;
const SCROLL_THRESHOLD = 150; // Khoảng cách từ bottom để coi là "ở dưới cùng"
const SHOW_BUTTON_THRESHOLD = 300; // Khoảng cách cuộn lên để hiện nút

// Helper function to format skill name: "skill-name" -> "Skill Name"
const formatSkillName = (name: string): string => {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

function UserMessage({ text, skills }: { text: string; skills?: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = text.length > COLLAPSE_THRESHOLD;
  
  const displayText = shouldCollapse && !isExpanded 
    ? text.slice(0, COLLAPSE_THRESHOLD) + '...'
    : text;

  return (
    <div className="space-y-2">
      {/* Skill Badges */}
      {skills && skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {skills.map((skill, idx) => (
            <div
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/80 text-accent-foreground text-xs font-medium"
            >
              {formatSkillName(skill)}
            </div>
          ))}
        </div>
      )}
      
      {/* Message Text */}
      {text && (
        <>
          <div className="whitespace-pre-wrap break-words text-foreground">
            {displayText}
          </div>
          {shouldCollapse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Thu gọn</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Xem thêm</span>
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function fixIncompleteCodeBlocks(text: string): string {
  const openingCount = (text.match(/^```/gm) || []).length;
  if (openingCount % 2 === 1) return text + '\n```';
  return text;
}

export function MessageList() {
  const { t } = useTranslation();
  const { messages, currentAssistantText, state, detachedTools, currentSessionId } = useChatStore();
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const lastMessageCount = useRef(messages.length);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const autoScrollEnabled = useRef(true); // Track if auto-scroll should happen
  const isScrollingToBottom = useRef(false); // Track if we're in the middle of scrolling to bottom
  const lastSessionId = useRef<string | null>(currentSessionId);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce scroll during streaming

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

  // Detect session change and scroll to bottom instantly
  useEffect(() => {
    if (currentSessionId !== lastSessionId.current) {
      lastSessionId.current = currentSessionId;
      
      // Reset scroll state
      autoScrollEnabled.current = true;
      userScrolledUp.current = false;
      isScrollingToBottom.current = false;
      setShowScrollButton(false);
      
      // Scroll to last message using virtualizer (works even if not rendered yet)
      if (messages.length > 0) {
        // Use requestAnimationFrame to ensure virtualizer is ready
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(messages.length - 1, {
            align: 'end',
            behavior: 'auto', // Instant scroll
          });
        });
      }
    }
  }, [currentSessionId, messages.length, virtualizer]);

  useEffect(() => {
    const el = scrollParentRef.current;
    if (!el) return;

    const onScroll = () => {
      if (isProgrammaticScroll.current) return;

      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      
      // Check if we've reached the bottom after scrolling
      if (distFromBottom <= SCROLL_THRESHOLD) {
        // User is at bottom - enable auto-scroll and clear scrolling flag
        autoScrollEnabled.current = true;
        userScrolledUp.current = false;
        isScrollingToBottom.current = false;
      } else if (distFromBottom > SHOW_BUTTON_THRESHOLD) {
        // Only disable auto-scroll if user scrolled up significantly
        // This prevents disabling during small scroll adjustments
        autoScrollEnabled.current = false;
        userScrolledUp.current = true;
      }

      // Only show button if not currently scrolling to bottom
      if (!isScrollingToBottom.current) {
        setShowScrollButton(distFromBottom > SHOW_BUTTON_THRESHOLD);
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Force scroll to bottom when user sends a new message
    if (messages.length > lastMessageCount.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'user') {
        // User just sent a message - force enable auto-scroll
        autoScrollEnabled.current = true;
        userScrolledUp.current = false;
        isScrollingToBottom.current = false;
        setShowScrollButton(false);
      }
    }
    lastMessageCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    // Only auto-scroll if enabled (user is at bottom or just sent a message)
    if (!autoScrollEnabled.current) return;

    const el = scrollParentRef.current;
    if (!el) return;
    
    // Clear any pending scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Debounce scroll during streaming to avoid jitter
    const isStreaming = state.status === 'GENERATING' && currentAssistantText;
    const delay = isStreaming ? 100 : 0; // Debounce 100ms when streaming
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Check if we're already near bottom - skip scroll if so
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom < 10) return; // Already at bottom
      
      isProgrammaticScroll.current = true;
      
      // Use instant scroll during streaming to avoid animation conflicts
      el.scrollTo({
        top: el.scrollHeight,
        behavior: isStreaming ? 'instant' : 'smooth',
      });

      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 50);
    }, delay);
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages.length, currentAssistantText, state.status]);

  // Handler for scroll button click
  const scrollToBottom = useCallback(() => {
    const el = scrollParentRef.current;
    if (!el) return;

    autoScrollEnabled.current = true;
    userScrolledUp.current = false;
    
    // Set flag to prevent button from showing during scroll
    isScrollingToBottom.current = true;
    setShowScrollButton(false);

    isProgrammaticScroll.current = true;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    });

    // Reset flags after scroll animation completes
    setTimeout(() => {
      isProgrammaticScroll.current = false;
      // isScrollingToBottom will be cleared by scroll event when reaching bottom
    }, 500);
  }, []);

  return (
    <div ref={scrollParentRef} className="flex-1 p-4 pb-3 overflow-y-auto relative">
      <div className="max-w-2xl mx-auto">
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
                className="pb-4"
              >
                <div
                  className={cn(
                    'flex w-full items-start',
                    message.role === 'user' ? 'justify-start' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'text-sm leading-relaxed w-full',
                      message.role === 'user'
                        ? 'rounded-lg bg-card border border-border px-3 py-2.5'
                        : ''
                    )}
                  >
                    <div className="space-y-3">
                      {message.blocks.map((block, blockIdx) => {
                        if (block.type === 'text') {
                          return (
                            <div key={blockIdx}>
                              {message.role === 'user' ? (
                                <UserMessage text={block.text || ''} skills={message.skills} />
                              ) : (
                                <MarkdownContent content={cleanSystemReminders(block.text || '')} />
                              )}
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
                        if (block.type === 'compact') {
                          return (
                            <CompactBlock
                              key={blockIdx}
                              status={block.status || 'started'}
                              estimatedTokens={block.estimatedTokens}
                              maxTokens={block.maxTokens}
                              removedCount={block.removedCount}
                              summary={block.summary}
                              newEstimatedTokens={block.newEstimatedTokens}
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
                                detachedTools,
                              })}
                            </div>
                          );
                        }
                        if (block.type === 'tool_result') return null;
                        return null;
                      })}
                    </div>
                    
                    {/* Footer for AI messages - only show on last message in sequence */}
                    {message.role === 'assistant' && (() => {
                      // Only show footer when AI is completely done (not generating or executing tools)
                      if (state.status === 'GENERATING' || state.status === 'TOOL_EXECUTING') return null;
                      
                      // Check if this is the last assistant message before next user message
                      const isLastInSequence = virtualItem.index === messages.length - 1 || 
                        messages[virtualItem.index + 1]?.role === 'user';
                      
                      if (!isLastInSequence) return null;
                      
                      // Collect all text from consecutive assistant messages (going backwards)
                      const assistantTexts: string[] = [];
                      for (let i = virtualItem.index; i >= 0; i--) {
                        const msg = messages[i];
                        if (msg.role !== 'assistant') break;
                        
                        const textBlocks = msg.blocks
                          .filter(b => b.type === 'text')
                          .map(b => b.text || '')
                          .reverse();
                        assistantTexts.unshift(...textBlocks);
                      }
                      
                      return (
                        <MessageFooter
                          content={assistantTexts.join('\n\n')}
                          modelName={message.modelName}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Streaming text */}
        {currentAssistantText && (
          <div className="flex w-full items-start justify-start mt-4">
            <div className="w-full text-sm leading-relaxed">
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
          <div className="flex w-full items-start justify-start mt-4">
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <AiThinkingIndicator className="text-primary opacity-80" />
              <span className="text-xs font-medium">{t('messageList.thinking')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Button - positioned relative to scroll container */}
      {showScrollButton && (
        <div className="sticky bottom-2 left-0 right-0 flex justify-center pointer-events-none z-50">
          <div className="pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Button
              onClick={scrollToBottom}
              size="icon"
              className="h-7 w-7 rounded-full shadow-lg hover:shadow-xl transition-all bg-card text-foreground hover:bg-card/80 border border-border"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
