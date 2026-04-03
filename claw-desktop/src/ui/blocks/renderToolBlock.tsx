// renderToolBlock - Strategy pattern for rendering specialized tool blocks
import { ContentBlock } from '../../core/entities';
import { ToolExecutionBlock } from './ToolExecutionBlock';
import { TodoListBlock, TodoWriteOutput } from './TodoListBlock';
import { XTermBlock } from './XTermBlock';
import { FileOperationBlock } from './FileOperationBlock';
import { SearchResultBlock } from './SearchResultBlock';
import { WebSearchBlock } from './WebSearchBlock';
import { DelegationBlock } from './DelegationBlock';

interface RenderToolBlockProps {
  toolUseBlock: ContentBlock;
  toolResultBlock?: ContentBlock;
}

// Detect if tool was cancelled by user
export function isCancelled(output?: string): boolean {
  if (!output) return false;
  const lowerOutput = output.toLowerCase();
  return (
    lowerOutput.includes('cancelled by user') ||
    lowerOutput.includes('đã dừng bởi người dùng') ||
    lowerOutput.includes('execution cancelled')
  );
}

export function renderToolBlock({ toolUseBlock, toolResultBlock }: RenderToolBlockProps) {
  const toolName = toolUseBlock.name || 'unknown';
  const toolInput = toolUseBlock.input || '';
  const toolOutput = toolResultBlock?.output;
  const isError = toolResultBlock?.is_error || false;
  const isStreaming = toolResultBlock?.isStreaming || false;
  const isPending = !toolResultBlock || isStreaming; // Pending if no result OR still streaming
  const isCancelledState = isError && isCancelled(toolOutput);
  const toolUseId = toolUseBlock.id;

  // Parse input JSON
  let parsedInput: any = {};
  try {
    parsedInput = JSON.parse(toolInput);
  } catch {
    // Keep empty object if parse fails
  }

  // TodoWrite - Task list
  if (toolName === 'TodoWrite' && toolOutput && !isError) {
    try {
      const todoOutput = JSON.parse(toolOutput) as TodoWriteOutput;
      return <TodoListBlock output={todoOutput} />;
    } catch (e) {
      console.error('Failed to parse TodoWrite output:', e);
    }
  }

  // Bash/PowerShell/REPL - Real Terminal with xterm.js
  if (['bash', 'PowerShell', 'REPL'].includes(toolName)) {
    return (
      <XTermBlock
        toolName={toolName as 'bash' | 'PowerShell' | 'REPL'}
        command={parsedInput.command || parsedInput.code || toolInput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
        toolUseId={toolUseId || undefined}
      />
    );
  }

  // File operations
  if (['read_file', 'write_file', 'edit_file'].includes(toolName)) {
    return (
      <FileOperationBlock
        toolName={toolName as 'read_file' | 'write_file' | 'edit_file'}
        filePath={parsedInput.path || parsedInput.file_path || 'unknown'}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // Search operations
  if (['grep_search', 'glob_search'].includes(toolName)) {
    return (
      <SearchResultBlock
        toolName={toolName as 'grep_search' | 'glob_search'}
        pattern={parsedInput.pattern || parsedInput.glob || toolInput}
        output={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // Web operations
  if (['WebSearch', 'WebFetch'].includes(toolName)) {
    return (
      <WebSearchBlock
        toolName={toolName as 'WebSearch' | 'WebFetch'}
        query={parsedInput.query || parsedInput.prompt || toolInput}
        url={parsedInput.url}
        output={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // Delegation (Skill/Agent)
  if (['Skill', 'Agent'].includes(toolName)) {
    return (
      <DelegationBlock
        toolName={toolName as 'Skill' | 'Agent'}
        name={parsedInput.skill || parsedInput.name || toolName}
        description={parsedInput.description}
        prompt={parsedInput.prompt}
        output={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // Fallback to generic ToolExecutionBlock
  return (
    <ToolExecutionBlock
      toolName={toolName}
      toolInput={toolInput}
      toolOutput={toolOutput}
      isError={isError}
      isPending={isPending}
      isCancelled={isCancelledState}
    />
  );
}
