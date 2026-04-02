// MessageList Component
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ToolExecutionBlock } from '../blocks';

export function MessageList() {
  const { messages, currentAssistantText, state } = useChatStore();

  // Tiền xử lý thẻ <think> của DeepSeek thành Markdown code block an toàn
  const processThinkTags = (text: string) => {
    if (!text) return '';
    return text.replace(/<think>/g, '```think\n').replace(/<\/think>/g, '\n```\n');
  };

  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');

      // Render giao diện riêng cho thẻ Think của DeepSeek
      if (!inline && match && match[1] === 'think') {
        return (
          <details className="my-2 bg-muted/30 rounded-lg border-l-4 border-slate-400 dark:border-slate-600 open:pb-2 transition-all" open>
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-600 dark:text-slate-400 px-3 py-2 hover:text-slate-800 dark:hover:text-slate-200 outline-none">
              🤔 Quá trình suy nghĩ
            </summary>
            <div className="px-3 text-sm italic text-muted-foreground whitespace-pre-wrap">
              {String(children).replace(/\n$/, '')}
            </div>
          </details>
        );
      }

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
  };

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
                          components={markdownComponents}
                        >
                          {processThinkTags(block.text || '')}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  if (block.type === 'tool_use') {
                    // Check if there's a corresponding tool_result in the same message
                    const toolResult = message.blocks.find(
                      (b) => b.type === 'tool_result' && b.tool_use_id === block.id
                    );

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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {processThinkTags(currentAssistantText)}
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
