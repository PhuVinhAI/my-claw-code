// MarkdownContent - Styled markdown renderer with Tailwind
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
          // Headings
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold mt-6 mb-4 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold mt-5 mb-3 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-4 mb-2 text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold mt-3 mb-2 text-foreground">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-base font-semibold mt-2 mb-1 text-foreground">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-semibold mt-2 mb-1 text-muted-foreground">{children}</h6>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="mb-4 leading-7 text-foreground">{children}</p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 mb-4 space-y-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 mb-4 space-y-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-7 text-foreground">{children}</li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 py-2 my-4 italic bg-muted/30 rounded-r">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-6 border-border" />,

          // Inline code
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            
            if (!inline && match) {
              // Code block with syntax highlighting and header
              const code = String(children).replace(/\n$/, '');
              return <CodeBlock language={match[1]} code={code} />;
            }
            
            // Inline code
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm border border-border"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Tables
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border hover:bg-muted/30 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-foreground border-r border-border last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-foreground border-r border-border last:border-r-0">
              {children}
            </td>
          ),

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-foreground">{children}</em>
          ),

          // Delete/Strikethrough
          del: ({ children }) => (
            <del className="line-through text-muted-foreground">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
