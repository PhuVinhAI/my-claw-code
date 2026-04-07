// FileOperationBlock — File operation with diff viewer
import { useState } from 'react';
import { FileText, FilePlus, FileEdit, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, GitCompare, Plus, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface FileOperationBlockProps {
  toolName: 'read_file' | 'write_file' | 'edit_file';
  filePath: string;
  toolInput?: string;
  toolOutput?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

interface StructuredPatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

interface WriteFileOutput {
  type: string;
  filePath: string;
  content: string;
  structuredPatch: StructuredPatchHunk[];
  originalFile?: string;
}

interface EditFileOutput {
  filePath: string;
  oldString: string;
  newString: string;
  originalFile: string;
  structuredPatch: StructuredPatchHunk[];
  userModified: boolean;
  replaceAll: boolean;
}

export function FileOperationBlock({
  toolName,
  filePath,
  toolInput,
  toolOutput,
  isError = false,
  isPending = false,
  isCancelled = false,
}: FileOperationBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const Icon = toolName === 'write_file' ? FilePlus : toolName === 'edit_file' ? FileEdit : FileText;
  const label = t(`fileOperation.${toolName === 'write_file' ? 'write' : toolName === 'edit_file' ? 'edit' : 'read'}`);
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Parse input parameters
  let additionalInfo = '';
  if (toolInput) {
    try {
      const parsed = JSON.parse(toolInput);
      if (toolName === 'read_file') {
        const parts = [];
        if (parsed.offset !== undefined && parsed.limit !== undefined) {
          parts.push(`${t('toolExecution.lines')} ${parsed.offset}-${parsed.offset + parsed.limit}`);
        } else if (parsed.offset !== undefined) {
          parts.push(`${t('toolExecution.from')} ${parsed.offset}`);
        } else if (parsed.limit !== undefined) {
          parts.push(`${parsed.limit} ${t('toolExecution.lines')}`);
        }
        if (parts.length > 0) additionalInfo = parts.join(', ');
      }
    } catch {}
  }

  // Parse output for diff
  let parsedOutput: WriteFileOutput | EditFileOutput | null = null;
  let hasDiff = false;
  let diffStats = { additions: 0, deletions: 0 };
  
  if (toolOutput && !isPending && (toolName === 'write_file' || toolName === 'edit_file')) {
    try {
      parsedOutput = JSON.parse(toolOutput);
      if (parsedOutput && 'structuredPatch' in parsedOutput && parsedOutput.structuredPatch.length > 0) {
        hasDiff = true;
        // Calculate diff stats
        for (const hunk of parsedOutput.structuredPatch) {
          for (const line of hunk.lines) {
            if (line.startsWith('+')) diffStats.additions++;
            else if (line.startsWith('-')) diffStats.deletions++;
          }
        }
      }
    } catch {}
  }

  const showDiffButton = hasDiff && !isError && !isCancelled;

  return (
    <div className="my-1.5 sm:my-2 bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/20 border-b border-border/30">
        <StatusIcon
          className={cn(
            'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
            isPending && 'animate-spin text-blue-400',
            isError && 'text-red-400',
            isCancelled && 'text-red-400',
            !isPending && !isError && !isCancelled && 'text-emerald-400'
          )}
        />
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground/70" />
        <span className={cn('font-semibold text-xs sm:text-sm text-foreground/90', isError && 'text-red-400')}>{label}</span>
        <span className="text-muted-foreground/30">|</span>
        <span className="font-mono truncate flex-1 text-muted-foreground/70 text-[10px] sm:text-xs">{filePath}</span>
        
        {additionalInfo && (
          <>
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <span className="font-mono text-muted-foreground/60 text-[10px] sm:text-xs hidden sm:inline">{additionalInfo}</span>
          </>
        )}
        
        {showDiffButton && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium">
              <span className="flex items-center gap-0.5 text-emerald-400">
                <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {diffStats.additions}
              </span>
              <span className="flex items-center gap-0.5 text-red-400">
                <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {diffStats.deletions}
              </span>
            </span>
          </>
        )}
        
        {isCancelled && (
          <span className="text-red-400 text-[10px] sm:text-xs font-medium bg-red-400/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-red-400/20">
            {t('fileOperation.stopped')}
          </span>
        )}
        {isError && !isCancelled && (
          <span className="text-red-400 text-[10px] sm:text-xs font-medium bg-red-400/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-red-400/20">
            {t('fileOperation.error')}
          </span>
        )}
      </div>

      {/* Expandable Diff */}
      {showDiffButton && parsedOutput && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-muted/5 hover:bg-muted/10 transition-colors text-left border-b border-border/20"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
            )}
            <GitCompare className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/70" />
            <span className="text-[10px] sm:text-xs text-muted-foreground/80 font-medium">
              {isExpanded ? t('fileOperation.hideDiff') : t('fileOperation.showDiff')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/5">
              <div className="rounded-lg overflow-hidden border border-border/30 bg-background">
                <div className="max-h-96 overflow-auto font-mono text-[11px] leading-relaxed">
                  {parsedOutput.structuredPatch.map((hunk, hunkIdx) => (
                    <div key={hunkIdx}>
                      {/* Hunk header */}
                      <div className="bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground/70 font-semibold border-b border-border/30">
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </div>
                      {/* Diff lines */}
                      {hunk.lines.map((line, lineIdx) => {
                        const isAddition = line.startsWith('+');
                        const isDeletion = line.startsWith('-');
                        const isContext = !isAddition && !isDeletion;
                        
                        return (
                          <div
                            key={lineIdx}
                            className={cn(
                              'px-3 py-0.5 whitespace-pre',
                              isAddition && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                              isDeletion && 'bg-red-500/10 text-red-600 dark:text-red-400',
                              isContext && 'bg-background text-foreground/80'
                            )}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
