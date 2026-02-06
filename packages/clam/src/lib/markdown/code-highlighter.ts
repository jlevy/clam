/**
 * Code block syntax highlighting using cli-highlight.
 *
 * Provides syntax-aware highlighting for fenced code blocks
 * in streaming markdown output.
 */

import { highlight, supportsLanguage } from 'cli-highlight';

import type { CodeHighlighter } from './types.js';

/**
 * Language aliases to map common names to highlight.js language identifiers.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  // JavaScript variants
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',

  // Shell variants
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',

  // Markup/data
  yml: 'yaml',
  md: 'markdown',

  // Common aliases
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  cs: 'csharp',
  cpp: 'cpp',
  'c++': 'cpp',
  'objective-c': 'objectivec',
  objc: 'objectivec',

  // Config files
  dockerfile: 'docker',
  makefile: 'makefile',
};

/**
 * Create a CodeHighlighter instance using cli-highlight.
 */
export function createCodeHighlighter(): CodeHighlighter {
  return {
    highlight(code: string, language: string): string {
      return highlightCode(code, language);
    },
  };
}

/**
 * Highlight code with syntax coloring.
 *
 * Falls back to plain text if the language is not supported.
 */
export function highlightCode(code: string, language: string): string {
  if (!language || language.trim() === '') {
    // No language specified - return plain code
    return code;
  }

  // Normalize language name
  const normalizedLang = normalizeLanguage(language);

  // Check if language is supported
  if (!supportsLanguage(normalizedLang)) {
    // Unsupported language - return plain code
    return code;
  }

  try {
    return highlight(code, {
      language: normalizedLang,
      ignoreIllegals: true,
    });
  } catch {
    // Highlighting failed - return plain code
    return code;
  }
}

/**
 * Normalize a language identifier.
 *
 * Handles aliases and case normalization.
 */
function normalizeLanguage(language: string): string {
  const lower = language.toLowerCase().trim();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

/**
 * Check if a language is supported for highlighting.
 */
export function isLanguageSupported(language: string): boolean {
  if (!language || language.trim() === '') {
    return false;
  }
  const normalized = normalizeLanguage(language);
  return supportsLanguage(normalized);
}
