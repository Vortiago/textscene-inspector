/**
 * The preprocessor's output: the text up to the last line end, and the open text after it, which
 * the next line end expands. Godot expands that text again even when it holds an include's output
 * (shader_preprocessor.cpp:771, 1311).
 */
export class PreprocessedOutput {
  private readonly closed: string[] = [];
  private open = '';

  append(text: string): void {
    this.open += text;
  }

  /** Writes the open text through `expand` and starts a new one. */
  expandOpenText(expand: (text: string) => string): void {
    this.closed.push(expand(this.open));
    this.open = '';
  }

  text(): string {
    return this.closed.join('') + this.open;
  }
}
