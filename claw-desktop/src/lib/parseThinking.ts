// Parse thinking tags from text content
// Supports: <think>...</think>, <thought>...</thought>, <thinking>...</thinking>

export interface ParsedContent {
  blocks: Array<{ type: 'text' | 'thinking'; content: string; isComplete: boolean }>;
}

const THINKING_PATTERNS = [
  { open: '<think>', close: '</think>' },
  { open: '<thought>', close: '</thought>' },
  { open: '<thinking>', close: '</thinking>' },
];

export function parseThinkingTags(text: string): ParsedContent {
  const blocks: Array<{ type: 'text' | 'thinking'; content: string; isComplete: boolean }> = [];
  
  // Filter out system reminders before parsing
  let remaining = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  let position = 0;

  while (position < remaining.length) {
    // Find the earliest thinking tag
    let earliestMatch: { 
      pattern: typeof THINKING_PATTERNS[0]; 
      start: number; 
      end: number;
      isComplete: boolean;
    } | null = null;

    for (const pattern of THINKING_PATTERNS) {
      const openIndex = remaining.indexOf(pattern.open, position);
      if (openIndex === -1) continue;

      const closeIndex = remaining.indexOf(pattern.close, openIndex + pattern.open.length);
      
      // If no closing tag, treat as incomplete (streaming)
      const isComplete = closeIndex !== -1;
      const end = isComplete ? closeIndex + pattern.close.length : remaining.length;

      if (!earliestMatch || openIndex < earliestMatch.start) {
        earliestMatch = {
          pattern,
          start: openIndex,
          end,
          isComplete,
        };
      }
    }

    if (!earliestMatch) {
      // No more thinking tags, add remaining text
      const textContent = remaining.slice(position).trim();
      if (textContent) {
        blocks.push({ type: 'text', content: textContent, isComplete: true });
      }
      break;
    }

    // Add text before thinking tag
    if (earliestMatch.start > position) {
      const textContent = remaining.slice(position, earliestMatch.start).trim();
      if (textContent) {
        blocks.push({ type: 'text', content: textContent, isComplete: true });
      }
    }

    // Extract thinking content (without tags)
    const contentStart = earliestMatch.start + earliestMatch.pattern.open.length;
    const contentEnd = earliestMatch.isComplete 
      ? earliestMatch.end - earliestMatch.pattern.close.length
      : earliestMatch.end;
    
    const thinkingContent = remaining.slice(contentStart, contentEnd).trim();

    // Always add thinking block, even if empty (for streaming indicator)
    blocks.push({ 
      type: 'thinking', 
      content: thinkingContent,
      isComplete: earliestMatch.isComplete,
    });

    // Move position past this thinking block
    position = earliestMatch.end;
  }

  return { blocks };
}

// Check if text contains any thinking tags
export function hasThinkingTags(text: string): boolean {
  return THINKING_PATTERNS.some((pattern) => text.includes(pattern.open));
}

// Remove system reminders from text
export function cleanSystemReminders(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}
