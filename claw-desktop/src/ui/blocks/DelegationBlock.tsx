// DelegationBlock — Skill/Agent delegation with full output
import { useState } from 'react';
import { Zap, Bot, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, FileText, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface DelegationBlockProps {
  toolName: 'Skill' | 'Agent';
  name: string;
  description?: string;
  prompt?: string;
  toolInput?: string; // Add this to parse input params
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

interface SkillOutput {
  skill: string;
  path: string;
  args?: string;
  description?: string;
  prompt: string;
}

interface AgentOutput {
  agentId: string;
  name: string;
  description: string;
  subagentType?: string;
  model?: string;
  status: string;
  outputFile: string;
  manifestFile: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export function DelegationBlock({
  toolName,
  name,
  toolInput,
  output,
  isError = false,
  isPending = false,
  isCancelled = false,
}: DelegationBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const Icon = toolName === 'Skill' ? Zap : Bot;
  const label = t(`delegation.${toolName.toLowerCase()}`);

  // Parse input for additional info
  let inputParams: any = {};
  if (toolInput) {
    try {
      inputParams = JSON.parse(toolInput);
    } catch {}
  }

  // Parse output
  let parsedOutput: SkillOutput | AgentOutput | null = null;
  if (output && !isPending) {
    try {
      parsedOutput = JSON.parse(output);
    } catch {}
  }

  const hasDetails = parsedOutput && !isPending && !isError && !isCancelled;

  return (
    <div className="my-1.5 sm:my-2 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-lg border border-indigo-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-indigo-500/10 border-b border-indigo-500/20">
        <StatusIcon
          className={cn(
            'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
            isPending && 'animate-spin text-indigo-500',
            isError && 'text-red-400',
            isCancelled && 'text-red-400',
            !isPending && !isError && !isCancelled && 'text-emerald-500'
          )}
        />
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-indigo-500/70" />
        <span className={cn('text-sm sm:text-base font-medium text-foreground', isError && 'text-red-400')}>{label}</span>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-sm sm:text-base font-medium flex-1 text-foreground/80 truncate">{name}</span>
        
        {/* Show subagent_type or model from input */}
        {toolName === 'Agent' && inputParams.subagent_type && (
          <>
            <span className="text-muted-foreground/40 hidden sm:inline">|</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground/70 hidden sm:inline">{t('delegation.subagentType')}: {inputParams.subagent_type}</span>
          </>
        )}
        {toolName === 'Agent' && inputParams.model && (
          <>
            <span className="text-muted-foreground/40 hidden sm:inline">|</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground/70 hidden sm:inline">{inputParams.model}</span>
          </>
        )}
        
        {isPending && <span className="text-[10px] sm:text-xs text-indigo-500 animate-pulse">{t('delegation.processing')}</span>}
        {isCancelled && <span className="text-red-400 text-[10px] sm:text-xs font-medium bg-red-400/10 px-1.5 sm:px-2 py-0.5 rounded-md">{t('delegation.stopped')}</span>}
        
        {parsedOutput && 'status' in parsedOutput && (
          <span className={cn(
            'text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-md',
            parsedOutput.status === 'running' && 'bg-blue-400/10 text-blue-400',
            parsedOutput.status === 'completed' && 'bg-emerald-400/10 text-emerald-400',
            parsedOutput.status === 'failed' && 'bg-red-400/10 text-red-400'
          )}>
            {t(`delegation.${parsedOutput.status}`)}
          </span>
        )}
      </div>

      {/* Expandable Details */}
      {hasDetails && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors text-left border-b border-indigo-500/10"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500/70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500/70" />
            )}
            <span className="text-[10px] sm:text-xs text-indigo-500/80 font-medium">
              {isExpanded ? t('delegation.hideDetails') : t('delegation.showDetails')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-indigo-500/5 space-y-2.5 sm:space-y-3">
              {toolName === 'Skill' && parsedOutput && 'path' in parsedOutput && (
                <>
                  <div className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                    <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 text-indigo-500/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-muted-foreground/70 mb-1">{t('delegation.path')}:</div>
                      <div className="font-mono text-foreground/80 break-all">{parsedOutput.path}</div>
                    </div>
                  </div>
                  
                  {parsedOutput.description && (
                    <div className="text-xs sm:text-sm text-foreground/80">
                      <div className="text-muted-foreground/70 text-[10px] sm:text-xs mb-1">{t('delegation.description')}:</div>
                      {parsedOutput.description}
                    </div>
                  )}
                  
                  {parsedOutput.args && (
                    <div className="text-[10px] sm:text-xs">
                      <div className="text-muted-foreground/70 mb-1">{t('delegation.args')}:</div>
                      <div className="font-mono text-foreground/80 bg-muted/20 px-2 py-1 rounded break-all">
                        {parsedOutput.args}
                      </div>
                    </div>
                  )}
                </>
              )}

              {toolName === 'Agent' && parsedOutput && 'agentId' in parsedOutput && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-[10px] sm:text-xs">
                    <div>
                      <div className="text-muted-foreground/70 mb-1">{t('delegation.agentId')}:</div>
                      <div className="font-mono text-foreground/80 break-all">{parsedOutput.agentId}</div>
                    </div>
                    {parsedOutput.model && (
                      <div>
                        <div className="text-muted-foreground/70 mb-1">{t('delegation.model')}:</div>
                        <div className="font-mono text-foreground/80 break-all">{parsedOutput.model}</div>
                      </div>
                    )}
                  </div>

                  {parsedOutput.description && (
                    <div className="text-xs sm:text-sm text-foreground/80">
                      <div className="text-muted-foreground/70 text-[10px] sm:text-xs mb-1">{t('delegation.description')}:</div>
                      {parsedOutput.description}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground/70">
                    <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>{t('delegation.created')}: {new Date(parsedOutput.createdAt).toLocaleString()}</span>
                  </div>

                  {parsedOutput.outputFile && (
                    <div className="text-[10px] sm:text-xs">
                      <div className="text-muted-foreground/70 mb-1">{t('delegation.outputFile')}:</div>
                      <div className="font-mono text-foreground/80 bg-muted/20 px-2 py-1 rounded break-all">
                        {parsedOutput.outputFile}
                      </div>
                    </div>
                  )}

                  {parsedOutput.error && (
                    <div className="text-[10px] sm:text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
                      {t('delegation.error')}: {parsedOutput.error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
