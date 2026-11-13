/**
 * An error in a shader's text, or a construct the transpiler does not transpile yet. The message
 * is Godot's own where Godot refuses the text, and names the owning issue where the transpiler
 * does not reach yet, so nothing is dropped in silence.
 */
export class ShadingLanguageError extends Error {
  constructor(
    message: string,
    /** The 1-based line of the shader text. */
    readonly line: number
  ) {
    super(`line ${line}: ${message}`);
    this.name = 'ShadingLanguageError';
  }
}
