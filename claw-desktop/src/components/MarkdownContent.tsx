// MarkdownContent - Clean, spacious markdown renderer
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CodeBlock } from './CodeBlock';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Headings — clean, well-spaced
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mt-4 mb-2 text-foreground tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-3.5 mb-1.5 text-foreground tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-medium mt-3 mb-1.5 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium mt-2.5 mb-1 text-foreground">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-xs font-medium mt-2 mb-1 text-foreground">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-[10px] font-medium mt-2 mb-1 text-muted-foreground uppercase tracking-wide">{children}</h6>
          ),

          // Paragraphs — clean spacing
          p: ({ children }) => (
            <p className="mb-3 text-sm leading-relaxed text-foreground">{children}</p>
          ),

          // Lists — clean spacing
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5 text-sm">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-foreground pl-1.5">{children}</li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium underline underline-offset-[3px] decoration-primary/30 hover:decoration-primary transition-colors"
            >
              {children}
            </a>
          ),

          // Blockquotes — subtle left accent
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-muted-foreground/30 pl-3 py-1 my-3 text-muted-foreground bg-muted/30 rounded-r-lg">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-4 border-border" />,

          // Code
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            
            if (!inline && match) {
              const code = String(children).replace(/\n$/, '');
              return <CodeBlock language={match[1]} code={code} />;
            }
            
            // Inline code — subtle
            return (
              <code
                className="px-1 py-0.5 rounded-md bg-muted text-foreground font-mono text-[0.85em] font-medium border border-border"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Tables — modern, borderless-style
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/30 border-b border-border/40">{children}</thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-border/30">{children}</tbody>,
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-muted/20">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-foreground/85">
              {children}
            </td>
          ),

          // Strong
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),

          // Emphasis
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),

          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-muted-foreground/60">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
