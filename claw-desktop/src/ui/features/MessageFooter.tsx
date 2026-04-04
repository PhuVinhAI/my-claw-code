// MessageFooter - Copy button and model badge for AI messages
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

interface MessageFooterProps {
  content: string;
  modelName?: string;
  className?: string;
}

export function MessageFooter({ content, modelName, className }: MessageFooterProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={cn('flex items-center justify-between gap-2 mt-3 pt-2 border-t border-border/40', className)}>
      <div className="flex items-center gap-2">
        {modelName && (
          <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal opacity-60">
            {modelName}
          </Badge>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 px-2 text-xs opacity-60 hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 mr-1" />
            Đã copy
          </>
        ) : (
          <>
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}
