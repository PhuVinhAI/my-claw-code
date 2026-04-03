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
    <div className="my-3 rounded-xl overflow-hidden bg-muted/10 border border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border/30">
        <span className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider font-semibold">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all duration-150 font-medium',
            copied
              ? 'text-emerald-400 bg-emerald-400/10'
              : 'text-muted-foreground/70 hover:text-foreground/90 hover:bg-muted/30'
          )}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Đã copy</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
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
          padding: '1rem 1.25rem',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '0.8125rem',
            lineHeight: '1.7',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
