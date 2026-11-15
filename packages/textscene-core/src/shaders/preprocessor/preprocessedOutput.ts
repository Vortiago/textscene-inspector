/** Godot expands the open text again, also over an include's output (shader_preprocessor.cpp:771). */
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
