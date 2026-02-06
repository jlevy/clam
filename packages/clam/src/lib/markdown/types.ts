/**
 * Types for the streaming markdown renderer.
 */

/**
 * Block types detected by the markdown renderer.
 */
export type BlockType = 'paragraph' | 'header' | 'code_fence' | 'table' | 'list' | 'blockquote';

/**
 * State of block detection.
 */
export type BlockState = 'normal' | 'in_code_fence' | 'in_table' | 'in_list' | 'in_blockquote';

/**
 * A detected block boundary.
 */
export interface BlockBoundary {
  /** Position in the buffer where the block ends */
  index: number;
  /** Type of the completed block */
  type: BlockType;
  /** Language hint for code blocks */
  language?: string;
}

/**
 * Interface for the streaming markdown renderer.
 */
export interface StreamRenderer {
  /** Process an incoming chunk. Returns formatted output or empty string. */
  processChunk(text: string): string;
  /** Flush remaining buffer at stream end. Returns formatted output. */
  flush(): string;
  /** Reset state for a new stream. */
  reset(): void;
}

/**
 * Interface for inline text formatting.
 */
export interface InlineFormatter {
  /** Format inline markdown (bold, italic, code, links). */
  format(text: string): string;
}

/**
 * Interface for code block highlighting.
 */
export interface CodeHighlighter {
  /** Highlight code with syntax coloring. */
  highlight(code: string, language: string): string;
}
