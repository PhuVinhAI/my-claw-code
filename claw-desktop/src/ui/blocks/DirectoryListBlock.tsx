// DirectoryListBlock - Display directory listing with tree view
import { useState } from 'react';
import { Folder, File, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface DirectoryEntry {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  modified?: string;
}

interface DirectoryListOutput {
  type: 'directory';
  path: string;
  entries: DirectoryEntry[];
  total: number;
}

interface DirectoryListBlockProps {
  path: string;
  output?: string;
  isError: boolean;
  isPending: boolean;
  isCancelled: boolean;
}

export function DirectoryListBlock({
  path,
  output,
  isError,
  isPending,
  isCancelled,
}: DirectoryListBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse output
  let parsedOutput: DirectoryListOutput | null = null;
  if (output && !isPending && !isError) {
    try {
      parsedOutput = JSON.parse(output);
    } catch (e) {
      console.error('Failed to parse list_directory output:', e);
    }
  }

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  // Separate directories and files
  const directories = parsedOutput?.entries.filter(e => e.type === 'dir') || [];
  const files = parsedOutput?.entries.filter(e => e.type === 'file') || [];

  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  return (
    <div className="my-1.5 sm:my-2">
      {/* Header - Inline compact style */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/20 border border-border/30 rounded-lg text-xs sm:text-sm transition-all hover:bg-muted/30 hover:border-border/50"
      >
        <StatusIcon
          className={cn(
            'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
            isPending && 'animate-spin text-blue-400',
            isError && 'text-red-400',
            isCancelled && 'text-red-400',
            !isPending && !isError && !isCancelled && 'text-emerald-400'
          )}
        />
        <Folder className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground/70" />
        <span className={cn('font-semibold text-foreground/90', isError && 'text-red-400')}>
          {t('search.listDirectory')}
        </span>
        <span className="text-muted-foreground/30">|</span>
        <span className="font-mono truncate flex-1 text-left text-muted-foreground/70 text-[10px] sm:text-xs">
          {path}
        </span>
        {parsedOutput && !isError && (
          <>
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <span className="font-mono text-muted-foreground/60 text-[10px] sm:text-xs hidden sm:inline">
              {t('search.items', { count: parsedOutput.total })}
            </span>
          </>
        )}
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 border border-border/30 rounded-lg overflow-hidden bg-muted/10">
          {/* Error state */}
          {isError && output && (
            <div className="text-xs text-destructive bg-destructive/10 px-3 py-2">
              {output}
            </div>
          )}

          {/* Success state */}
          {parsedOutput && !isError && (
            <div className="space-y-0">
              {/* Summary */}
              <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/20 border-b border-border/20">
                {t('search.items', { count: parsedOutput.total })} ({t('search.folders', { count: directories.length })}, {t('search.files', { count: files.length })})
              </div>

              {/* Directory list */}
              <div className="font-mono text-xs max-h-96 overflow-y-auto">
                {/* Directories first */}
                {directories.map((entry, idx) => (
                  <div
                    key={`dir-${idx}`}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 border-b border-border/10 last:border-0 group"
                  >
                    <Folder className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1 text-foreground">{entry.name}</span>
                    <span className="text-muted-foreground text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                      folder
                    </span>
                  </div>
                ))}

                {/* Files */}
                {files.map((entry, idx) => (
                  <div
                    key={`file-${idx}`}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 border-b border-border/10 last:border-0 group"
                  >
                    <File className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-foreground">{entry.name}</span>
                    {entry.size && (
                      <span className="text-muted-foreground text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatSize(entry.size)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Empty directory */}
              {parsedOutput.total === 0 && (
                <div className="text-xs text-muted-foreground italic px-3 py-3 text-center">
                  {t('search.emptyDirectory')}
                </div>
              )}
            </div>
          )}

          {/* Pending state */}
          {isPending && !isCancelled && (
            <div className="text-xs text-muted-foreground italic px-3 py-3 text-center">
              {t('search.readingDirectory')}
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <div className="text-xs text-muted-foreground italic px-3 py-3 text-center">
              {t('search.stopped')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
