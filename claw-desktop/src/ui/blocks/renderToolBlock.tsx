// renderToolBlock - Strategy pattern for rendering specialized tool blocks
import { ContentBlock } from '../../core/entities';
import { ToolExecutionBlock } from './ToolExecutionBlock';
import { TodoListBlock, TodoWriteOutput } from './TodoListBlock';
import { XTermBlock } from './XTermBlock';
import { REPLBlock } from './REPLBlock';
import { FileOperationBlock } from './FileOperationBlock';
import { SearchResultBlock } from './SearchResultBlock';
import { WebSearchBlock } from './WebSearchBlock';
import { DelegationBlock } from './DelegationBlock';
import { DirectoryListBlock } from './DirectoryListBlock';
import { LSPBlock } from './LSPBlock';
import { AskUserQuestionBlock } from './AskUserQuestionBlock';
import { ContextGeneratorBlock } from './ContextGeneratorBlock';

interface RenderToolBlockProps {
  toolUseBlock: ContentBlock;
  toolResultBlock?: ContentBlock;
  detachedTools?: Set<string>; // Pass from parent component
}

export function renderToolBlock({ toolUseBlock, toolResultBlock, detachedTools }: RenderToolBlockProps) {
  const toolName = toolUseBlock.name || 'unknown';
  const toolInput = toolUseBlock.input || '';
  const toolOutput = toolResultBlock?.output;
  const isError = toolResultBlock?.is_error || false;
  const isCancelledFromBackend = toolResultBlock?.is_cancelled || false;
  const isTimedOutFromBackend = toolResultBlock?.is_timed_out || false;
  const isStreaming = toolResultBlock?.isStreaming ?? false; // Default to false if undefined
  const isPending = !toolResultBlock || isStreaming; // Pending if no result OR still streaming
  const isCancelledState = isCancelledFromBackend;
  const toolUseId = toolUseBlock.id;
  
  // Check if tool is detached (from parent)
  const isDetached = toolUseId && detachedTools ? detachedTools.has(toolUseId) : false;

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
    // Parse bash output JSON to get raw stdout
    let rawOutput: string | undefined;
    if (toolOutput && !isPending) {
      try {
        const bashOutput = JSON.parse(toolOutput);
        rawOutput = bashOutput.stdout || toolOutput; // Fallback to raw if parse fails
      } catch {
        rawOutput = toolOutput; // Use raw if not JSON
      }
    }

    // REPL gets special UI with collapsible code
    if (toolName === 'REPL') {
      return (
        <REPLBlock
          code={parsedInput.code || toolInput}
          language={parsedInput.language || 'python'}
          toolInput={toolInput}
          isError={isError}
          isPending={isPending}
          isCancelled={isCancelledState}
          toolUseId={toolUseId || undefined}
          output={rawOutput}
        />
      );
    }

    // Bash/PowerShell use standard terminal
    return (
      <XTermBlock
        toolName={toolName as 'bash' | 'PowerShell'}
        command={parsedInput.command || parsedInput.code || toolInput}
        toolInput={toolInput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
        isTimedOut={isTimedOutFromBackend}
        isDetached={isDetached}
        toolUseId={toolUseId || undefined}
        output={rawOutput}
      />
    );
  }

  // File operations
  if (['read_file', 'write_file', 'edit_file'].includes(toolName)) {
    return (
      <FileOperationBlock
        toolName={toolName as 'read_file' | 'write_file' | 'edit_file'}
        filePath={parsedInput.path || parsedInput.file_path || 'unknown'}
        toolInput={toolInput}
        toolOutput={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // Directory listing
  if (toolName === 'list_directory') {
    return (
      <DirectoryListBlock
        path={parsedInput.path || 'unknown'}
        output={toolOutput}
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
        toolInput={toolInput}
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
        toolInput={toolInput}
        output={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // LSP (Language Server Protocol)
  if (toolName === 'LSP' || toolName === 'lsp') {
    return (
      <LSPBlock
        action={parsedInput.action || 'unknown'}
        path={parsedInput.path}
        line={parsedInput.line}
        character={parsedInput.character}
        query={parsedInput.query}
        toolInput={toolInput}
        output={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // AskUserQuestion / PromptUser - Interactive Q&A
  if (toolName === 'AskUserQuestion' || toolName === 'PromptUser') {
    return (
      <AskUserQuestionBlock
        question={parsedInput.question || 'Question'}
        options={parsedInput.options}
        toolUseId={toolUseId || undefined}
        output={toolOutput}
        isError={isError}
        isPending={isPending}
        isCancelled={isCancelledState}
      />
    );
  }

  // MasterContext - Context generation with download
  if (toolName === 'MasterContext') {
    return (
      <ContextGeneratorBlock
        toolOutput={toolOutput}
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
