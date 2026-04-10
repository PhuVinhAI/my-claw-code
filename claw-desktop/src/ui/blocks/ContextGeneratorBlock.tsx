// ContextGeneratorBlock — Display generated context with download button
import { useState } from 'react';
import { FileText, Download, Copy, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';

interface ContextGeneratorBlockProps {
  toolOutput?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

interface ContextOutput {
  context_name: string;
  context: string;
  file_count: number;
  token_count: number;
  options: {
    with_line_numbers: boolean;
    without_comments: boolean;
    remove_debug_logs: boolean;
    exclude_extensions: string[];
  };
}

export function ContextGeneratorBlock({
  toolOutput,
  isError = false,
  isPending = false,
  isCancelled = false,
}: ContextGeneratorBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Parse output
  let parsedOutput: ContextOutput | null = null;
  let contextPreview = '';
  
  if (toolOutput && !isPending) {
    try {
      parsedOutput = JSON.parse(toolOutput);
      if (parsedOutput && parsedOutput.context) {
        // Get first 500 chars for preview
        contextPreview = parsedOutput.context.substring(0, 500);
        if (parsedOutput.context.length > 500) {
          contextPreview += '...';
        }
      }
    } catch (e) {
      console.error('Failed to parse context output:', e);
    }
  }

  const handleCopy = async () => {
    if (!parsedOutput?.context) return;
    
    try {
      await navigator.clipboard.writeText(parsedOutput.context);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = async () => {
    if (!parsedOutput?.context || isSaving) return;
    
    setIsSaving(true);
    try {
      // Use context_name as filename, sanitize it for filesystem
      const sanitizedName = parsedOutput.context_name
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
      const defaultFilename = `${sanitizedName}.txt`;
      
      await invoke('save_context_to_file', {
        content: parsedOutput.context,
        defaultFilename,
      });
    } catch (err: any) {
      if (err !== 'User cancelled') {
        console.error('Failed to save context:', err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const contextSize = parsedOutput?.context ? 
    (parsedOutput.context.length / 1024).toFixed(1) + ' KB' : 
    '';
  
  const tokenCount = parsedOutput?.token_count || 0;

  return (
    <div className="my-1.5 bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="group flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30">
        <StatusIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isPending && 'animate-spin text-blue-400',
            isError && 'text-red-400',
            isCancelled && 'text-red-400',
            !isPending && !isError && !isCancelled && 'text-emerald-400'
          )}
        />
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className={cn('font-semibold text-xs text-foreground/90', isError && 'text-red-400')}>
          {parsedOutput?.context_name || t('contextGenerator.title')}
        </span>
        
        {parsedOutput && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-[10px] text-muted-foreground/70">
              {parsedOutput.file_count} {t('contextGenerator.files')}
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-[10px] text-muted-foreground/70">
              {contextSize}
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-[10px] font-medium text-blue-400">
              ~{tokenCount.toLocaleString()} {t('contextGenerator.tokens')}
            </span>
          </>
        )}
        
        {/* Status badges and action buttons - right aligned */}
        <div className="ml-auto flex items-center gap-1">
          {isCancelled && (
            <span className="text-red-400 text-[10px] font-medium bg-red-400/10 px-1.5 py-0.5 rounded-md border border-red-400/20">
              {t('contextGenerator.stopped')}
            </span>
          )}
          {isError && !isCancelled && (
            <span className="text-red-400 text-[10px] font-medium bg-red-400/10 px-1.5 py-0.5 rounded-md border border-red-400/20">
              {t('contextGenerator.error')}
            </span>
          )}
          
          {/* Action buttons */}
          {parsedOutput && !isError && !isCancelled && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-md transition-colors"
                title={t('contextGenerator.copy')}
              >
                {isCopied ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {isCopied ? t('contextGenerator.copied') : t('contextGenerator.copy')}
              </button>
              <button
                onClick={handleDownload}
                disabled={isSaving}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('contextGenerator.download')}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                {isSaving ? t('contextGenerator.saving') : t('contextGenerator.download')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expandable Preview */}
      {parsedOutput && !isError && !isCancelled && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-muted/5 hover:bg-muted/10 transition-colors text-left border-b border-border/20"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
            )}
            <FileText className="h-3 w-3 text-muted-foreground/70" />
            <span className="text-[10px] text-muted-foreground/80 font-medium">
              {isExpanded ? t('contextGenerator.hidePreview') : t('contextGenerator.showPreview')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-3 py-2 bg-muted/5">
              <div className="rounded-lg overflow-hidden border border-border/30 bg-background">
                <div className="max-h-96 overflow-auto font-mono text-[11px] leading-relaxed p-3 whitespace-pre-wrap">
                  {parsedOutput.context}
                </div>
              </div>
              
              {/* Options info */}
              {(parsedOutput.options.with_line_numbers || 
                parsedOutput.options.without_comments || 
                parsedOutput.options.remove_debug_logs ||
                parsedOutput.options.exclude_extensions.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parsedOutput.options.with_line_numbers && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded border border-blue-500/20">
                      {t('contextGenerator.withLineNumbers')}
                    </span>
                  )}
                  {parsedOutput.options.without_comments && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded border border-purple-500/20">
                      {t('contextGenerator.withoutComments')}
                    </span>
                  )}
                  {parsedOutput.options.remove_debug_logs && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded border border-orange-500/20">
                      {t('contextGenerator.removeDebugLogs')}
                    </span>
                  )}
                  {parsedOutput.options.exclude_extensions.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded border border-red-500/20">
                      {t('contextGenerator.excluded')}: {parsedOutput.options.exclude_extensions.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
