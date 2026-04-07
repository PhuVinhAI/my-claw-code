// CodeBlock - Minimal code block with header and copy
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isDark = document.documentElement.classList.contains('dark');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden bg-muted/10 border border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/30">
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider font-semibold">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-all duration-150 font-medium',
            copied
              ? 'text-emerald-400 bg-emerald-400/10'
              : 'text-muted-foreground/70 hover:text-foreground/90 hover:bg-muted/30'
          )}
        >
          {copied ? (
            <>
              <Check className="w-2.5 h-2.5" />
              <span>Đã copy</span>
            </>
          ) : (
            <>
              <Copy className="w-2.5 h-2.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        style={isDark ? oneDark : oneLight as any}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: 'transparent',
          padding: '0.75rem 0.875rem',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '0.6875rem',
            lineHeight: '1.5',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
