import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'hunk';
  oldLineNum?: number;
  newLineNum?: number;
  content: string;
}

interface DiffGroup {
  type: 'unchanged' | 'changed';
  lines: DiffLine[];
  unchangedCount?: number;
}

interface GitDiffViewerProps {
  diffContent: string;
}

export function GitDiffViewer({ diffContent }: GitDiffViewerProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const parseDiff = (text: string): DiffLine[] => {
    const lines = text.split('\n');
    const parsed: DiffLine[] = [];
    const seenLines = new Set<string>(); // Dedupe tracking
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      // Skip ALL header lines completely
      if (!line || line.trim() === '' || 
          line.startsWith('---') || line.startsWith('+++') || 
          line.startsWith('@@') || line.startsWith('diff ') || 
          line.startsWith('index ')) {
        // Extract line numbers from @@ if present for tracking
        if (line.startsWith('@@')) {
          const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
          if (match) {
            oldLineNum = parseInt(match[1]);
            newLineNum = parseInt(match[2]);
          }
        }
        continue;
      }
      
      // Create unique key for deduplication
      const lineKey = `${line[0]}-${oldLineNum}-${newLineNum}-${line.substring(1)}`;
      if (seenLines.has(lineKey)) {
        continue; // Skip duplicate
      }
      seenLines.add(lineKey);
      
      if (line.startsWith('+')) {
        parsed.push({ type: 'add', newLineNum: newLineNum++, content: line.substring(1) });
      } else if (line.startsWith('-')) {
        parsed.push({ type: 'remove', oldLineNum: oldLineNum++, content: line.substring(1) });
      } else if (line.startsWith(' ')) {
        parsed.push({ 
          type: 'context', 
          oldLineNum: oldLineNum++, 
          newLineNum: newLineNum++, 
          content: line.substring(1) 
        });
      }
    }

    return parsed;
  };

  const groupDiffLines = (lines: DiffLine[]): DiffGroup[] => {
    const groups: DiffGroup[] = [];
    let currentGroup: DiffLine[] = [];
    let currentType: 'unchanged' | 'changed' | null = null;

    for (const line of lines) {
      if (line.type === 'hunk') continue; // Skip hunk headers
      
      const lineType = line.type === 'context' ? 'unchanged' : 'changed';
      
      if (lineType !== currentType) {
        if (currentGroup.length > 0) {
          // Collapse unchanged lines if more than 5
          if (currentType === 'unchanged' && currentGroup.length > 5) {
            groups.push({ 
              type: 'unchanged', 
              lines: currentGroup, // Keep lines for expand
              unchangedCount: currentGroup.length 
            });
          } else {
            groups.push({ type: currentType!, lines: currentGroup });
          }
        }
        currentGroup = [line];
        currentType = lineType;
      } else {
        currentGroup.push(line);
      }
    }

    if (currentGroup.length > 0) {
      if (currentType === 'unchanged' && currentGroup.length > 5) {
        groups.push({ type: 'unchanged', lines: currentGroup, unchangedCount: currentGroup.length });
      } else {
        groups.push({ type: currentType!, lines: currentGroup });
      }
    }

    return groups;
  };

  const toggleGroup = (index: number) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedGroups(newCollapsed);
  };

  const diffLines = parseDiff(diffContent);
  const groups = groupDiffLines(diffLines);

  return (
    <div className="bg-[#1e1e1e] text-xs font-mono rounded max-h-96 overflow-auto scrollbar-thin w-full">
      <div className="inline-block min-w-full">
      {groups.map((group, groupIndex) => {
        if (group.type === 'unchanged' && group.unchangedCount) {
          const isExpanded = collapsedGroups.has(groupIndex);
          
          return (
            <div key={groupIndex}>
              {/* Collapse/Expand Button */}
              <button
                onClick={() => toggleGroup(groupIndex)}
                className="w-full flex items-center gap-2 px-3 py-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] transition-colors text-[#858585] text-[11px]"
              >
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>{group.unchangedCount} unchanged lines</span>
              </button>
              
              {/* Expanded Lines */}
              {isExpanded && group.lines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className="flex items-start"
                >
                  {/* Single Line Number */}
                  <div className="w-12 px-2 text-right text-[#858585] select-none border-r border-[#3d3d3d] shrink-0">
                    {line.newLineNum || line.oldLineNum || ''}
                  </div>

                  {/* Code Content */}
                  <div className="flex-1 px-3 py-0.5 whitespace-pre text-[#d4d4d4]">
                    {line.content || ' '}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={groupIndex}>
            {group.lines.map((line, lineIndex) => {
              const isAdd = line.type === 'add';
              const isRemove = line.type === 'remove';
              const isContext = line.type === 'context';

              return (
                <div
                  key={lineIndex}
                  className={cn(
                    'flex items-start w-full',
                    isAdd && 'bg-[#1a3d1a]',
                    isRemove && 'bg-[#3d1a1a]'
                  )}
                >
                  {/* Single Line Number */}
                  <div className="w-12 px-2 text-right text-[#858585] select-none border-r border-[#3d3d3d] shrink-0">
                    {line.newLineNum || line.oldLineNum || ''}
                  </div>

                  {/* Code Content - with background and full width */}
                  <div className={cn(
                    'flex-1 px-3 py-0.5 whitespace-nowrap',
                    isAdd && 'text-[#4ec9b0] bg-[#1a3d1a]',
                    isRemove && 'text-[#f48771] bg-[#3d1a1a]',
                    isContext && 'text-[#d4d4d4]'
                  )}>
                    {line.content || ' '}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
    </div>
  );
}
