/**
 * Streaming markdown renderer for terminal output.
 *
 * Public API:
 * - createBlockRenderer(): Create a streaming markdown renderer
 * - formatInline(): Format inline markdown elements
 *
 * Usage:
 * ```typescript
 * import { createBlockRenderer } from './markdown/index.js';
 *
 * const renderer = createBlockRenderer();
 *
 * // During streaming
 * for (const chunk of streamingChunks) {
 *   const formatted = renderer.processChunk(chunk);
 *   if (formatted) {
 *     write(formatted);
 *   }
 * }
 *
 * // At stream end
 * const final = renderer.flush();
 * if (final) {
 *   write(final);
 * }
 * ```
 */

export { type BlockDetector, createBlockDetector } from './block-detector.js';
export {
  type BlockRenderer,
  type BlockRendererOptions,
  createBlockRenderer,
  renderMarkdownBlock,
} from './block-renderer.js';

export { createCodeHighlighter, highlightCode, isLanguageSupported } from './code-highlighter.js';

export { createInlineFormatter, formatInline, hasUnclosedFormatting } from './inline-formatter.js';

export type {
  BlockBoundary,
  BlockState,
  BlockType,
  CodeHighlighter,
  InlineFormatter,
  StreamRenderer,
} from './types.js';
