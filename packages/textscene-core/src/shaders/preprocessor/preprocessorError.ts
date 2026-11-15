/** A text Godot's preprocessor refuses: its message and 0-based line, in the file it reads then. */
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
