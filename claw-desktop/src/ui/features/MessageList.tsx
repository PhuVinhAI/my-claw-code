// MessageList Component
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ToolExecutionBlock, TodoListBlock, TodoWriteOutput } from '../blocks';

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
                  : 'max-w-full lg:max-w-3xl w-full'
              )}
            >
              <div className="space-y-2">
                {message.blocks.map((block, blockIdx) => {
                  if (block.type === 'text') {
                    return (
                      <div key={blockIdx} className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneDark as any}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {block.text || ''}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  if (block.type === 'tool_use') {
                    // Check if there's a corresponding tool_result in the same message
                    const toolResult = message.blocks.find(
                      (b) => b.type === 'tool_result' && b.tool_use_id === block.id
                    );

                    // Special rendering for TodoWrite tool
                    if (block.name === 'TodoWrite' && toolResult?.output && !toolResult.is_error) {
                      try {
                        const todoOutput = JSON.parse(toolResult.output) as TodoWriteOutput;
                        return <TodoListBlock key={blockIdx} output={todoOutput} />;
                      } catch (e) {
                        // Fallback to generic tool block if parsing fails
                        console.error('Failed to parse TodoWrite output:', e);
                      }
                    }

                    return (
                      <ToolExecutionBlock
                        key={blockIdx}
                        toolName={block.name || 'unknown'}
                        toolInput={block.input || ''}
                        toolOutput={toolResult?.type === 'tool_result' ? toolResult.output : undefined}
                        isError={toolResult?.type === 'tool_result' ? toolResult.is_error : undefined}
                        isPending={!toolResult}
                      />
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
            <div className="max-w-full lg:max-w-3xl w-full rounded-lg px-3 py-2 text-sm">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentAssistantText}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {state.status === 'GENERATING' && !currentAssistantText && (
          <div className="flex w-full items-start gap-2 justify-start">
            <div className="max-w-full lg:max-w-3xl w-full rounded-lg px-3 py-2 text-sm">
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
