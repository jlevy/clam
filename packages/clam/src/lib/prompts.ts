/**
 * Prompts - Context injection for Claude prompts.
 *
 * This module handles formatting prompts with context like working directories,
 * environment info, and other metadata that Claude needs to correctly interpret
 * user requests.
 *
 * All injected prompts are defined as constants below for easy review and modification.
 */

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

/**
 * Injected when session and user are in the same directory.
 * Placeholder: {cwd}
 */
const PROMPT_SAME_CWD = `[Working directory: {cwd}]`;

/**
 * Injected when user has cd'd to a different directory than the session.
 * Placeholders: {sessionCwd}, {userCwd}
 *
 * This is important because:
 * - Claude's tools (Bash, Read, Write) execute in sessionCwd
 * - The user sees userCwd in their shell prompt
 * - Relative paths from the user mean relative to userCwd
 */
const PROMPT_DIFFERENT_CWD = `[Working directories]
Your cwd: {sessionCwd}
User's cwd: {userCwd}
Note: If the user mentions relative file paths, they mean paths relative to their cwd.`;

// =============================================================================
// TYPES AND FUNCTIONS
// =============================================================================

/**
 * Options for formatting a prompt with context.
 */
export interface PromptContextOptions {
  /** The session's working directory (where Claude's tools execute) */
  sessionCwd: string;
  /** The user's current working directory (what they see in the shell) */
  userCwd: string;
}

/**
 * Format a prompt with working directory context for Claude.
 *
 * @param text - The user's prompt text
 * @param options - Context options including working directories
 * @returns The formatted prompt with context header
 */
export function formatPromptWithContext(text: string, options: PromptContextOptions): string {
  const { sessionCwd, userCwd } = options;

  if (userCwd === sessionCwd) {
    const header = PROMPT_SAME_CWD.replace('{cwd}', userCwd);
    return `${header}\n\n${text}`;
  }

  const header = PROMPT_DIFFERENT_CWD.replace('{sessionCwd}', sessionCwd).replace(
    '{userCwd}',
    userCwd
  );
  return `${header}\n\n${text}`;
}
