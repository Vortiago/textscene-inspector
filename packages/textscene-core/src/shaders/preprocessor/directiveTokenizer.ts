import { stripEdges } from '../../godot/string/string.js';
import { END, isCharEnd, isCharSpace, isValidAsciiIdentifier, isWhitespace } from './godotString.js';

export class DirectiveTokenizer {
  // Godot's String ends in a 0 the reader returns as a character.
  private readonly code: string;
  index = 0;
  line = 0;
  // A line break read inside a directive, written out later so each line keeps its number.
  private generated: string[] = [];

  constructor(code: string) {
    this.code = code + END;
  }

  next(): string {
    return this.index < this.code.length ? this.code[this.index++]! : END;
  }

  peek(): string {
    return this.index < this.code.length ? this.code[this.index]! : END;
  }

  takeGenerated(): string {
    const text = this.generated.join('');
    this.generated = [];
    return text;
  }

  backtrack(what: string): void {
    while (this.index >= 0 && this.code[this.index] !== what) this.index -= 1;
  }

  consumeLineContinuations(offset: number): number {
    let skips = 0;
    for (let at = this.index + offset; at < this.code.length; at += 1) {
      const char = this.code[at]!;
      if (char === '\\') {
        if (this.code[at + 1] !== '\n') break;
        this.generated.push('\n');
        this.line += 1;
        skips += 1;
        at += 2;
        this.index = at;
      } else if (!isWhitespace(char)) {
        break;
      }
    }
    return skips;
  }

  advance(what: string): string {
    const characters: string[] = [];
    while (this.index < this.code.length) {
      const char = this.code[this.index++]!;
      if (char === '\\' && this.consumeLineContinuations(-1) > 0) continue;
      if (char === '\n') {
        this.generated.push('\n');
        this.line += 1;
      }
      characters.push(char);
      if (char === what || char === END) return characters.join('');
    }
    return '';
  }

  skipWhitespace(): void {
    while (isCharSpace(this.peek())) this.next();
  }

  consumeEmptyLine(): boolean {
    return stripEdges(this.advance('\n')) === '';
  }

  /** An empty string for a word that is no identifier. */
  identifier(started = false): string {
    const text: string[] = [];
    for (;;) {
      const char = this.peek();
      if (char === '\\' && this.consumeLineContinuations(0) > 0) continue;
      if (isCharEnd(char) || char === '(' || char === ')' || char === ',' || char === ';') break;
      if (isWhitespace(char) && started) break;
      if (!isWhitespace(char)) started = true;
      const read = this.next();
      if (started) text.push(read);
    }
    const id = text.join('');
    return isValidAsciiIdentifier(id) ? id : '';
  }

  peekIdentifier(): string {
    const { index, line } = this;
    const id = this.identifier();
    this.index = index;
    this.line = line;
    return id;
  }

  token(): string {
    if (this.index >= this.code.length) return END;
    const char = this.code[this.index++]!;
    if (isCharSpace(char)) {
      this.skipWhitespace();
      return ' ';
    }
    if (char === '\n') this.line += 1;
    return char;
  }
}
