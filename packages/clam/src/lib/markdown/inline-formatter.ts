/**
 * Inline markdown formatter using picocolors.
 *
 * Handles:
 * - **bold**
 * - *italic* and _italic_
 * - `inline code`
 * - [links](url)
 * - ~~strikethrough~~
 */

import pc from 'picocolors';

import type { InlineFormatter } from './types.js';

/**
 * Create an inline formatter instance.
 */
export function createInlineFormatter(): InlineFormatter {
  return {
    format(text: string): string {
      return formatInline(text);
    },
  };
}

/**
 * Format inline markdown elements.
 *
 * Processing order matters - we process in order of specificity:
 * 1. Inline code (extract and protect from other formatting)
 * 2. Links (prevents processing of markdown in link text)
 * 3. Bold (**text**)
 * 4. Italic (*text* and _text_)
 * 5. Strikethrough (~~text~~)
 * 6. Restore inline code with styling
 */
export function formatInline(text: string): string {
  // Extract inline code first to protect contents from other formatting
  // Use placeholders to prevent markdown processing inside code
  const codeSpans: string[] = [];
  const placeholder = '\x00CODE\x00';

  // Handles both `code` and ``code with ` inside``
  let result = text.replace(
    /``(.+?)``|`([^`\n]+)`/g,
    (_match: string, double: string | undefined, single: string | undefined): string => {
      const code = double ?? single ?? '';
      const index = codeSpans.length;
      codeSpans.push(pc.cyan(code));
      return `${placeholder}${index}${placeholder}`;
    }
  );

  // Links: [text](url) - show text in blue, underlined
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, linkText: string): string => {
      return pc.blue(pc.underline(linkText));
    }
  );

  // Bold: **text** or __text__
  result = result.replace(
    /\*\*(.+?)\*\*|__(.+?)__/g,
    (_match: string, asterisk: string | undefined, underscore: string | undefined): string => {
      const content = asterisk ?? underscore ?? '';
      return pc.bold(content);
    }
  );

  // Italic: *text* or _text_ (but not inside words for underscore)
  // Handle asterisk italic
  result = result.replace(
    /(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g,
    (_match: string, content: string): string => {
      return pc.italic(content);
    }
  );

  // Handle underscore italic (only at word boundaries)
  result = result.replace(
    /(?<=^|[\s(])\b_([^_\n]+?)_\b(?=[\s).,!?]|$)/g,
    (_match: string, content: string): string => {
      return pc.italic(content);
    }
  );

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_match: string, content: string): string => {
    return pc.strikethrough(content);
  });

  // Restore inline code spans
  result = result.replace(
    new RegExp(`${placeholder}(\\d+)${placeholder}`, 'g'),
    (_match: string, index: string): string => {
      return codeSpans[Number.parseInt(index, 10)] ?? '';
    }
  );

  return result;
}

/**
 * Check if text has unclosed inline formatting.
 * Used to detect if we should buffer more text.
 */
export function hasUnclosedFormatting(text: string): boolean {
  // Count emphasis markers
  const boldMatches = text.match(/\*\*/g)?.length ?? 0;
  if (boldMatches % 2 !== 0) return true;

  const underscoreBoldMatches = text.match(/__/g)?.length ?? 0;
  if (underscoreBoldMatches % 2 !== 0) return true;

  // Check for unclosed inline code
  const backtickCount = text.match(/`/g)?.length ?? 0;
  if (backtickCount % 2 !== 0) return true;

  // Check for unclosed links [text](url)
  const openBracket = text.lastIndexOf('[');
  if (openBracket !== -1) {
    const closeBracket = text.indexOf(']', openBracket);
    if (closeBracket === -1) return true;
    const openParen = text.indexOf('(', closeBracket);
    if (openParen !== -1 && openParen === closeBracket + 1) {
      const closeParen = text.indexOf(')', openParen);
      if (closeParen === -1) return true;
    }
  }

  return false;
}
