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
            <h1 className="text-2xl font-semibold mt-6 mb-3 text-foreground tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-2.5 text-foreground tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium mt-4 mb-2 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium mt-3 mb-1.5 text-foreground">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-medium mt-2 mb-1 text-foreground">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-medium mt-2 mb-1 text-muted-foreground uppercase tracking-wide">{children}</h6>
          ),

          // Paragraphs — generous line-height
          p: ({ children }) => (
            <p className="mb-3 leading-[1.75] text-foreground/90">{children}</p>
          ),

          // Lists — clean spacing
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-[1.7] text-foreground/90 pl-1">{children}</li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-[3px] decoration-foreground/25 hover:decoration-foreground/60 transition-colors"
            >
              {children}
            </a>
          ),

          // Blockquotes — subtle left accent
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-foreground/15 pl-4 py-0.5 my-3 text-muted-foreground">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-6 border-border/50" />,

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
                className="px-1.5 py-0.5 rounded-md bg-muted/70 text-foreground/90 font-mono text-[0.85em]"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Tables — modern, borderless-style
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-sm">
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
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-foreground/85">
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
