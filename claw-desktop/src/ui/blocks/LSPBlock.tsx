// LSPBlock — Language Server Protocol queries with expandable results
import { useState } from 'react';
import { Code, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, AlertCircle, Info, MapPin, FileCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface LSPBlockProps {
  action: string;
  path?: string;
  line?: number;
  character?: number;
  query?: string;
  toolInput?: string;
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

interface LspDiagnostic {
  path: string;
  line: number;
  character: number;
  severity: string;
  message: string;
  source?: string;
}

interface LspLocation {
  path: string;
  line: number;
  character: number;
  end_line?: number;
  end_character?: number;
  preview?: string;
}

interface LspHoverResult {
  content: string;
  language?: string;
}

interface LspSymbol {
  name: string;
  kind: string;
  path: string;
  line: number;
  character: number;
}

interface LspCompletionItem {
  label: string;
  kind?: string;
  detail?: string;
  insert_text?: string;
}

interface DiagnosticsOutput {
  action: 'diagnostics';
  path?: string;
  diagnostics: LspDiagnostic[];
  count: number;
}

interface GenericLspOutput {
  action: string;
  path?: string;
  line?: number;
  character?: number;
  language?: string;
  status?: string;
  message?: string;
  hover?: LspHoverResult;
  locations?: LspLocation[];
  symbols?: LspSymbol[];
  completions?: LspCompletionItem[];
}

export function LSPBlock({
  action,
  path,
  line,
  character,
  query,
  output,
  isError = false,
  isPending = false,
  isCancelled = false,
}: LSPBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  
  // Get action label
  const getActionLabel = () => {
    switch (action) {
      case 'diagnostics': return t('lsp.diagnostics');
      case 'hover': return t('lsp.hover');
      case 'definition': case 'goto_definition': return t('lsp.definition');
      case 'references': case 'find_references': return t('lsp.references');
      case 'completion': case 'completions': return t('lsp.completion');
      case 'symbols': case 'document_symbols': return t('lsp.symbols');
      case 'format': case 'formatting': return t('lsp.format');
      default: return action;
    }
  };

  // Parse output
  let parsedOutput: DiagnosticsOutput | GenericLspOutput | null = null;
  let resultCount = 0;

  if (output && !isPending) {
    try {
      parsedOutput = JSON.parse(output);
      
      if (parsedOutput && 'diagnostics' in parsedOutput) {
        resultCount = parsedOutput.diagnostics?.length || 0;
      } else if (parsedOutput && 'locations' in parsedOutput) {
        resultCount = parsedOutput.locations?.length || 0;
      } else if (parsedOutput && 'symbols' in parsedOutput) {
        resultCount = parsedOutput.symbols?.length || 0;
      } else if (parsedOutput && 'completions' in parsedOutput) {
        resultCount = parsedOutput.completions?.length || 0;
      }
    } catch {}
  }

  const hasResults = !isPending && !isError && !isCancelled && parsedOutput;
  const isDiagnostics = action === 'diagnostics';

  // Build display info
  const displayInfo = [];
  if (path) displayInfo.push(path);
  if (line !== undefined && character !== undefined) {
    displayInfo.push(`${line}:${character}`);
  }
  if (query) displayInfo.push(`"${query}"`);
  
  // Count diagnostics by severity
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  if (isDiagnostics && parsedOutput && 'diagnostics' in parsedOutput) {
    parsedOutput.diagnostics.forEach((diag) => {
      if (diag.severity === 'error') errorCount++;
      else if (diag.severity === 'warning') warningCount++;
      else if (diag.severity === 'info' || diag.severity === 'hint') infoCount++;
    });
  }

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
        <Code className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className={cn('text-xs font-semibold text-foreground/90', isError && 'text-red-400')}>
          {getActionLabel()}
        </span>
        
        {displayInfo.length > 0 && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <span className="font-mono truncate flex-1 text-muted-foreground/70 text-[10px]">
              {displayInfo.join(' ')}
            </span>
          </>
        )}

        {parsedOutput && 'language' in parsedOutput && parsedOutput.language && (
          <span className="text-[10px] font-medium bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-400/20">
            {parsedOutput.language}
          </span>
        )}
        
        {/* Diagnostics: Show error/warning counts inline */}
        {isDiagnostics && hasResults && (
          <div className="flex items-center gap-1.5">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded-md border border-red-400/20">
                <AlertCircle className="h-3 w-3" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded-md border border-yellow-400/20">
                <AlertCircle className="h-3 w-3" />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-400/20">
                <Info className="h-3 w-3" />
                {infoCount}
              </span>
            )}
          </div>
        )}
        
        {/* Other actions: Show result count */}
        {!isDiagnostics && hasResults && resultCount > 0 && (
          <span className="text-[10px] font-medium bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-400/20">
            {t('lsp.results', { count: resultCount })}
          </span>
        )}
        
        {isCancelled && (
          <span className="text-red-400 text-[10px] font-medium bg-red-400/10 px-1.5 py-0.5 rounded-md border border-red-400/20">
            {t('lsp.stopped')}
          </span>
        )}
        {isError && !isCancelled && (
          <span className="text-red-400 text-[10px] font-medium bg-red-400/10 px-1.5 py-0.5 rounded-md border border-red-400/20">
            {t('lsp.error')}
          </span>
        )}
      </div>

      {/* Expandable Results - Skip for diagnostics */}
      {hasResults && !isDiagnostics && (
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
            <span className="text-[10px] text-muted-foreground/80 font-medium">
              {isExpanded ? t('lsp.hideResults') : t('lsp.showResults')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-3 py-2 bg-muted/5 max-h-96 overflow-auto">
              {/* Diagnostics */}
              {parsedOutput && 'diagnostics' in parsedOutput && parsedOutput.diagnostics && (
                <div className="space-y-1.5">
                  {parsedOutput.diagnostics.map((diag, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-1.5 p-1.5 rounded-md border',
                        diag.severity === 'error' && 'bg-red-400/5 border-red-400/20',
                        diag.severity === 'warning' && 'bg-yellow-400/5 border-yellow-400/20',
                        diag.severity === 'info' && 'bg-blue-400/5 border-blue-400/20',
                        diag.severity === 'hint' && 'bg-muted/20 border-border/20'
                      )}
                    >
                      {diag.severity === 'error' && <AlertCircle className="h-3 w-3 mt-0.5 text-red-400 shrink-0" />}
                      {diag.severity === 'warning' && <AlertCircle className="h-3 w-3 mt-0.5 text-yellow-400 shrink-0" />}
                      {diag.severity === 'info' && <Info className="h-3 w-3 mt-0.5 text-blue-400 shrink-0" />}
                      {diag.severity === 'hint' && <Info className="h-3 w-3 mt-0.5 text-muted-foreground/60 shrink-0" />}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-mono text-muted-foreground/60">
                            {diag.path}:{diag.line}:{diag.character}
                          </span>
                          {diag.source && (
                            <span className="text-muted-foreground/50">({diag.source})</span>
                          )}
                        </div>
                        <div className="text-xs text-foreground/90 mt-0.5">
                          {diag.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Locations (Definition/References) */}
              {parsedOutput && 'locations' in parsedOutput && parsedOutput.locations && (
                <div className="space-y-1.5">
                  {parsedOutput.locations.map((loc, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 p-1.5 rounded-md hover:bg-muted/20 transition-colors border border-border/20"
                    >
                      <MapPin className="h-3 w-3 mt-0.5 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {loc.path}:{loc.line}:{loc.character}
                        </div>
                        {loc.preview && (
                          <div className="text-xs text-foreground/80 mt-0.5 font-mono">
                            {loc.preview}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Symbols */}
              {parsedOutput && 'symbols' in parsedOutput && parsedOutput.symbols && (
                <div className="space-y-1.5">
                  {parsedOutput.symbols.map((symbol, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 p-1.5 rounded-md hover:bg-muted/20 transition-colors border border-border/20"
                    >
                      <FileCode className="h-3 w-3 mt-0.5 text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground/90">
                            {symbol.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 bg-muted/20 px-1 py-0.5 rounded">
                            {symbol.kind}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                          {symbol.path}:{symbol.line}:{symbol.character}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hover Result */}
              {parsedOutput && 'hover' in parsedOutput && parsedOutput.hover && (
                <div className="p-2 bg-muted/20 rounded-lg border border-border/30">
                  <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono">
                    {parsedOutput.hover.content}
                  </pre>
                </div>
              )}

              {/* Completions */}
              {parsedOutput && 'completions' in parsedOutput && parsedOutput.completions && (
                <div className="space-y-1">
                  {parsedOutput.completions.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 p-1.5 rounded-md hover:bg-muted/20 transition-colors border border-border/20"
                    >
                      <span className="text-xs font-mono text-foreground/90">
                        {item.label}
                      </span>
                      {item.kind && (
                        <span className="text-[10px] text-muted-foreground/60 bg-muted/20 px-1 py-0.5 rounded">
                          {item.kind}
                        </span>
                      )}
                      {item.detail && (
                        <span className="text-[10px] text-muted-foreground/60 truncate">
                          {item.detail}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Generic message for dispatched actions */}
              {parsedOutput && 'message' in parsedOutput && parsedOutput.message && !('diagnostics' in parsedOutput) && !('locations' in parsedOutput) && !('symbols' in parsedOutput) && !('hover' in parsedOutput) && !('completions' in parsedOutput) && (
                <div className="text-xs text-muted-foreground/70 italic">
                  {parsedOutput.message}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
