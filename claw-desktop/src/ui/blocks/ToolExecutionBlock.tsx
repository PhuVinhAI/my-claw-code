// ToolExecutionBlock — Tool execution with beautiful UI for each tool
import { useState } from 'react';
import { Terminal, FileText, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Clock, Settings, Search, MessageSquare, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface ToolExecutionBlockProps {
  toolName: string;
  toolInput: string;
  toolOutput?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

interface SleepOutput {
  duration_ms: number;
  message: string;
}

interface ConfigOutput {
  success: boolean;
  operation?: string;
  setting?: string;
  value?: any;
  previousValue?: any;
  newValue?: any;
  error?: string;
}

interface ToolSearchOutput {
  matches: string[];
  query: string;
  normalized_query: string;
  total_deferred_tools: number;
  pending_mcp_servers?: string[];
}

interface SendUserMessageOutput {
  message: string;
  attachments?: Array<{
    path: string;
    size: number;
    isImage: boolean;
  }>;
  sentAt: string;
}

interface StructuredOutputResult {
  data: string;
  structured_output: Record<string, any>;
}

export function ToolExecutionBlock({
  toolName,
  toolInput,
  toolOutput,
  isError = false,
  isPending = false,
  isCancelled = false,
}: ToolExecutionBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getToolIcon = () => {
    switch (toolName) {
      case 'bash': case 'REPL': case 'PowerShell': return Terminal;
      case 'read_file': case 'write_file': case 'edit_file': return FileText;
      case 'Sleep': return Clock;
      case 'Config': return Settings;
      case 'ToolSearch': return Search;
      case 'SendUserMessage': return MessageSquare;
      case 'StructuredOutput': return Package;
      default: return Terminal;
    }
  };

  const ToolIcon = getToolIcon();
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Parse input to extract meaningful info
  let displayLabel = '';
  let displayValue = toolInput;
  
  try {
    const parsed = JSON.parse(toolInput);
    if (toolName === 'Sleep' && parsed.duration_ms) {
      displayLabel = t('toolExecution.duration'); displayValue = `${parsed.duration_ms}ms`;
    } else if (toolName === 'Config') {
      displayLabel = parsed.setting ? t('toolExecution.setting') : t('toolExecution.getConfig'); displayValue = parsed.setting || '';
    } else if (toolName === 'ToolSearch' && parsed.query) {
      displayLabel = t('toolExecution.searchTool'); 
      displayValue = `"${parsed.query}"`;
      if (parsed.max_results) {
        displayValue += ` (${t('toolExecution.maxResults')} ${parsed.max_results})`;
      }
    } else if (toolName === 'SendUserMessage' && parsed.status) {
      displayLabel = 'status'; displayValue = parsed.status;
    } else if (parsed.query) {
      displayLabel = t('toolExecution.query'); displayValue = parsed.query;
    } else if (parsed.command) {
      displayLabel = t('toolExecution.command'); displayValue = parsed.command;
    } else if (parsed.path) {
      displayLabel = t('toolExecution.path'); displayValue = parsed.path;
    } else {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        displayLabel = key; displayValue = String(value);
      }
    }
  } catch { displayValue = toolInput; }

  // Parse output
  let parsedOutput: SleepOutput | ConfigOutput | ToolSearchOutput | SendUserMessageOutput | StructuredOutputResult | any = null;
  if (toolOutput && !isPending) {
    try {
      parsedOutput = JSON.parse(toolOutput);
    } catch {}
  }

  const hasOutput = parsedOutput && !isPending && !isError && !isCancelled;
  
  // Determine if we should show inline summary instead of expandable
  const showInlineSummary = hasOutput && ['Sleep', 'Config', 'StructuredOutput'].includes(toolName);

  // Get inline summary text
  const getInlineSummary = (): string | null => {
    if (!parsedOutput) return null;
    
    if (toolName === 'Sleep' && 'message' in parsedOutput) {
      const sleepOutput = parsedOutput as SleepOutput;
      return t('toolExecution.sleptFor', { duration: sleepOutput.duration_ms });
    }
    
    if (toolName === 'Config' && 'success' in parsedOutput) {
      const configOutput = parsedOutput as ConfigOutput;
      if (configOutput.error) {
        const errorMsg = configOutput.error;
        const unknownSettingMatch = errorMsg.match(/Unknown setting: "(.+)"/);
        if (unknownSettingMatch) {
          return t('toolExecution.unknownSetting', { setting: unknownSettingMatch[1] });
        }
        return errorMsg;
      }
      if (configOutput.value !== undefined) {
        const valueStr = typeof configOutput.value === 'object' 
          ? JSON.stringify(configOutput.value) 
          : String(configOutput.value);
        return `${configOutput.setting}: ${valueStr}`;
      }
      return configOutput.success ? t('toolExecution.success') : t('toolExecution.failed');
    }
    
    if (toolName === 'StructuredOutput' && 'structured_output' in parsedOutput) {
      const structOutput = parsedOutput as StructuredOutputResult;
      const entries = Object.entries(structOutput.structured_output);
      if (entries.length === 1) {
        const [key, value] = entries[0];
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${valueStr.length > 50 ? valueStr.substring(0, 50) + '...' : valueStr}`;
      }
      return t('toolExecution.fields', { count: entries.length });
    }
    
    return null;
  };

  const inlineSummary = showInlineSummary ? getInlineSummary() : null;

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
        <ToolIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className={cn('font-semibold text-xs leading-4 text-foreground/90', isError && 'text-red-400')}>
          {toolName}
        </span>
        {displayLabel && (
          <>
            <span className="text-muted-foreground/30 leading-4">|</span>
            <span className="text-muted-foreground/60 text-[10px] leading-4">{displayLabel}:</span>
          </>
        )}
        {displayValue && (
          <span className="font-mono truncate flex-1 text-muted-foreground/70 text-[10px] leading-4">
            {displayValue.length > 60 ? displayValue.substring(0, 60) + '…' : displayValue}
          </span>
        )}
        
        {/* Inline summary for simple tools */}
        {inlineSummary && (
          <>
            <span className="text-muted-foreground/30 leading-4">|</span>
            <span className={cn(
              "font-mono text-[10px] leading-4 truncate max-w-xs",
              toolName === 'Config' && parsedOutput && 'error' in parsedOutput && parsedOutput.error
                ? "text-red-400"
                : "text-foreground/80"
            )}>
              {inlineSummary}
            </span>
          </>
        )}
        
        {isCancelled && (
          <span className="text-red-400 text-[10px] leading-4 font-medium bg-red-400/10 px-1.5 py-0.5 rounded-md border border-red-400/20">
            {t('toolExecution.stopped')}
          </span>
        )}
        {isError && !isCancelled && (
          <span className="text-red-400 text-[10px] leading-4 font-medium bg-red-400/10 px-1.5 py-0.5 rounded-md border border-red-400/20">
            {t('toolExecution.error')}
          </span>
        )}
      </div>

      {/* Auto-expanded or Expandable Output (only for complex tools) */}
      {hasOutput && !showInlineSummary && (
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
              {isExpanded ? t('toolExecution.hideOutput') : t('toolExecution.showOutput')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-3 py-2 bg-muted/5">
              {/* ToolSearch Output */}
              {toolName === 'ToolSearch' && 'matches' in parsedOutput && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-foreground/90">
                      {t('toolExecution.foundTools', { count: parsedOutput.matches.length })}
                    </span>
                  </div>

                  {parsedOutput.matches.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parsedOutput.matches.map((match: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/20 rounded-md border border-border/20 font-mono text-xs text-foreground/90"
                        >
                          <Package className="h-3 w-3 text-blue-400" />
                          {match}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/70 italic">
                      {t('toolExecution.noToolsFound')}
                    </div>
                  )}

                  {parsedOutput.pending_mcp_servers && parsedOutput.pending_mcp_servers.length > 0 && (
                    <div className="text-[10px] text-muted-foreground/70 p-1.5 bg-muted/10 rounded">
                      {t('toolExecution.pendingMcpServers')}: {parsedOutput.pending_mcp_servers.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* SendUserMessage Output */}
              {toolName === 'SendUserMessage' && 'message' in parsedOutput && (
                <div className="space-y-2">
                  <div className="p-2 bg-blue-400/5 border border-blue-400/20 rounded-lg">
                    <div className="flex items-start gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/90 whitespace-pre-wrap">
                          {parsedOutput.message}
                        </div>
                        {parsedOutput.sentAt && (
                          <div className="text-[10px] text-muted-foreground/70 mt-1.5">
                            {t('toolExecution.sentAt')}: {
                              (() => {
                                const date = new Date(parsedOutput.sentAt);
                                return isNaN(date.getTime()) ? t('toolExecution.invalidDate') : date.toLocaleString();
                              })()
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {parsedOutput.attachments && parsedOutput.attachments.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-muted-foreground/70 font-medium">{t('toolExecution.attachments')}:</div>
                      {parsedOutput.attachments.map((att: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 p-1.5 bg-muted/20 rounded-md border border-border/20 text-[10px]"
                        >
                          <FileText className="h-3 w-3 text-muted-foreground/70" />
                          <span className="font-mono flex-1 truncate">{att.path}</span>
                          <span className="text-muted-foreground/60">{(att.size / 1024).toFixed(1)} KB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* StructuredOutput */}
              {toolName === 'StructuredOutput' && 'structured_output' in parsedOutput && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-foreground/90">{t('toolExecution.structuredOutput')}</span>
                  </div>

                  <div className="space-y-1.5">
                    {Object.entries(parsedOutput.structured_output).map(([key, value]) => (
                      <div key={key} className="p-2 bg-muted/20 rounded-lg border border-border/30">
                        <div className="text-[10px] text-muted-foreground/70 mb-1 font-medium">{key}</div>
                        <div className="font-mono text-xs text-foreground/90">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generic JSON output for other tools */}
              {!['Sleep', 'Config', 'ToolSearch', 'SendUserMessage', 'StructuredOutput'].includes(toolName) && (
                <pre className="text-[10px] text-foreground/80 font-mono whitespace-pre-wrap bg-muted/20 px-2 py-1.5 rounded overflow-auto max-h-64">
                  {JSON.stringify(parsedOutput, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
