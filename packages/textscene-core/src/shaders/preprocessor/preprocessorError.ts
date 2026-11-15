/** The error of a text Godot's shader preprocessor refuses, at the file and line it names. */

/** `line` is 0-based, as Godot counts it. */
export class PreprocessorError extends Error {
  constructor(
    readonly reason: string,
    readonly line: number,
    readonly file = ''
  ) {
    super(`${file ? `${file}:` : ''}${line + 1}: ${reason}`);
    this.name = 'PreprocessorError';
  }
}
