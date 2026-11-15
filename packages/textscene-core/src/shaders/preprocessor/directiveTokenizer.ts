/**
 * The preprocessor's character reader (`ShaderPreprocessor::Tokenizer`,
 * `shader_preprocessor.cpp:36`). A line break the reader moves past inside a directive is kept
 * as a generated character, which the preprocessor writes out, so every line keeps its number.
 */

import {
  END,
  isCharEnd,
  isCharSpace,
  isValidAsciiIdentifier,
  isWhitespace,
  stripEdges,
} from './godotString.js';

export class DirectiveTokenizer {
  /** The text and Godot's terminator, which the reader returns as a character. */
  private readonly code: string;
  index = 0;
  /** 0-based. */
  line = 0;
  /** Written by `advance` and `consumeLineContinuations`. Cleared by `takeGenerated`. */
  private generated: string[] = [];

  constructor(code: string) {
    this.code = code + END;
  }

  /** `next`: the character at the index, which the index moves past, or the end. */
  next(): string {
    return this.index < this.code.length ? this.code[this.index++]! : END;
  }

  peek(): string {
    return this.index < this.code.length ? this.code[this.index]! : END;
  }

  /** `get_and_clear_generated`. */
  takeGenerated(): string {
    const text = this.generated.join('');
    this.generated = [];
    return text;
  }

  /** Moves the index back to the last `what` at or before it. */
  backtrack(what: string): void {
    while (this.index >= 0 && this.code[this.index] !== what) this.index -= 1;
  }

  /** Moves past each `\` and line break from `index + offset`, over whitespace. Answers how many. */
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

  /** The characters up to and with the next `what` or the end, or none when the text ends first. */
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

  /** `consume_empty_line`: reads the rest of the line, and answers whether it held nothing. */
  consumeEmptyLine(): boolean {
    return stripEdges(this.advance('\n')) === '';
  }

  /**
   * `get_identifier`: the word at the index, or an empty string when it is not an identifier.
   * Space before the word is skipped unless `started` holds.
   */
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

  /** `peek_identifier`: the identifier at the index, which the index stays before. */
  peekIdentifier(): string {
    const { index, line } = this;
    const id = this.identifier();
    this.index = index;
    this.line = line;
    return id;
  }

  /** `get_token`: the next character, with a run of spaces and tabs as one space. */
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
