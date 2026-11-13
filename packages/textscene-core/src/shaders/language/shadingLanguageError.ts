/**
 * An error in a shader's text, or a construct the transpiler does not transpile yet. The message
 * is Godot's own where Godot refuses the text, and names the owning issue where the transpiler
 * does not reach yet, so nothing is dropped in silence.
 */

/**
 * Where a token or a tree node starts. The line is Godot's (`error_line`, `shader_language.h:984`).
 * Godot reports no column, so the column is the transpiler's own.
 */
export interface SourcePosition {
  /** The shader's path, or an empty string for a text with no file. */
  readonly file: string;
  /** 1-based. */
  readonly line: number;
  /** 1-based, in UTF-16 code units. */
  readonly column: number;
}

export class ShadingLanguageError extends Error {
  constructor(
    /** Godot's message, or the transpiler's for a construct it does not transpile yet. */
    readonly reason: string,
    readonly position: SourcePosition
  ) {
    super(`${position.file ? `${position.file}:` : ''}${position.line}:${position.column}: ${reason}`);
    this.name = 'ShadingLanguageError';
  }

  get line(): number {
    return this.position.line;
  }
}
