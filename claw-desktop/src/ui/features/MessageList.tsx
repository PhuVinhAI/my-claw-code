// MessageList Component
import { useChatStore } from '../../store';
import { cn } from '../../lib/utils';

export function MessageList() {
  const { messages, currentAssistantText } = useChatStore();

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
              {message.blocks.map((block, blockIdx) => {
                if (block.type === 'text') {
                  return (
                    <div key={blockIdx} className="whitespace-pre-wrap">
                      {block.text}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {/* Current streaming text */}
        {currentAssistantText && (
          <div className="flex w-full items-start gap-2 justify-start">
            <div className="max-w-full lg:max-w-3xl w-full rounded-lg px-3 py-2 text-sm">
              <div className="whitespace-pre-wrap">{currentAssistantText}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
