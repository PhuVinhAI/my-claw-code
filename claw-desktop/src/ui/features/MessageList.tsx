// MessageList Component
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import { renderToolBlock, ThinkingBlock } from '../blocks';
import { parseThinkingTags } from '../../lib/parseThinking';
import { MarkdownContent } from '../../components/MarkdownContent';

// Helper: Tạm đóng code blocks chưa hoàn chỉnh khi streaming
function fixIncompleteCodeBlocks(text: string): string {
  // Count opening ``` 
  const openingCount = (text.match(/^```/gm) || []).length;
  
  // If odd number of ```, add closing ```
  if (openingCount % 2 === 1) {
    return text + '\n```';
  }
  
  return text;
}

export function MessageList() {
  const { messages, currentAssistantText, state } = useChatStore();

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={cn(
              'flex w-full items-start gap-2',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'max-w-xs md:max-w-md lg:max-w-lg bg-muted'
                  : 'w-full'
              )}
            >
              <div className="space-y-2">
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
                    // Check if there's a corresponding tool_result in the same message
                    const toolResult = message.blocks.find(
                      (b) => b.type === 'tool_result' && b.tool_use_id === block.id
                    );

                    // Use specialized block renderer
                    return (
                      <div key={blockIdx}>
                        {renderToolBlock({
                          toolUseBlock: block,
                          toolResultBlock: toolResult,
                        })}
                      </div>
                    );
                  }
                  // Skip tool_result blocks as they're rendered with tool_use
                  if (block.type === 'tool_result') {
                    return null;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Current streaming text */}
        {currentAssistantText && (
          <div className="flex w-full items-start gap-2 justify-start">
            <div className="w-full rounded-lg px-3 py-2 text-sm">
              {(() => {
                // Parse thinking tags in real-time
                const parsed = parseThinkingTags(currentAssistantText);
                
                return (
                  <div className="space-y-2">
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
          <div className="flex w-full items-start gap-2 justify-start">
            <div className="w-full rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-pulse">●</div>
                <span>AI đang suy nghĩ...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
