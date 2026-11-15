import { ShadingLanguageError, type SourcePosition } from './shadingLanguageError.js';
import type { Token } from './tokenizer.js';

export class TokenCursor {
  private index = 0;
  /** The index of the token read last: -1 before the first read, and the end token once read. */
  private lastRead = -1;

  constructor(private readonly tokens: readonly Token[]) {}

  peek(): Token {
    return this.tokens[this.index]!;
  }

  next(): Token {
    const token = this.peek();
    this.lastRead = this.index;
    if (token.type !== 'TK_EOF') this.index += 1;
    return token;
  }

  /** The place to go back to, as `_get_tkpos` gives it. */
  mark(): number {
    return this.index;
  }

  /** Goes back to `mark`, as `_set_tkpos` does, with the token before it as the one read last. */
  reset(mark: number): void {
    this.index = mark;
    this.lastRead = mark - 1;
  }

  accept(type: string): boolean {
    if (this.peek().type !== type) return false;
    this.next();
    return true;
  }

  /** Reads a token of `type`, or fails with Godot's `message` at the token found instead. */
  expect(type: string, message: string): Token {
    const token = this.next();
    if (token.type !== type) this.fail(message);
    return token;
  }

  /** Godot's failure `message`, at the token read last. */
  fail(message: string): never {
    throw new ShadingLanguageError(message, this.lastPosition());
  }

  lastPosition(): SourcePosition {
    return this.tokens[Math.max(0, this.lastRead)]!.position;
  }
}
