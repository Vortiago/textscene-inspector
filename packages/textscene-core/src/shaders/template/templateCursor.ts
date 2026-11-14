/**
 * The template parser's place in the preprocessed tokens. A failure names the token where the
 * parser stands, with glslang's form of message: `'<token>' : <reason>`.
 */

import { ShadingLanguageError, type SourcePosition } from '../language/shadingLanguageError.js';
import type { PpToken } from './ppScanner.js';

/** The words GLSL 4.50 keeps for later versions, which no name may take (section 3.6). */
const RESERVED_WORDS = new Set([
  'common',
  'partition',
  'active',
  'asm',
  'class',
  'union',
  'enum',
  'typedef',
  'template',
  'this',
  'resource',
  'goto',
  'inline',
  'noinline',
  'public',
  'static',
  'extern',
  'external',
  'interface',
  'long',
  'short',
  'half',
  'fixed',
  'unsigned',
  'superp',
  'input',
  'output',
  'hvec2',
  'hvec3',
  'hvec4',
  'fvec2',
  'fvec3',
  'fvec4',
  'sampler3DRect',
  'filter',
  'sizeof',
  'cast',
  'namespace',
  'using',
]);

export class TemplateCursor {
  private index = 0;

  constructor(private readonly tokens: readonly PpToken[]) {}

  peek(offset = 0): PpToken | undefined {
    return this.tokens[this.index + offset];
  }

  /** The text of the token `offset` ahead, or an empty string at the end. */
  peekText(offset = 0): string {
    return this.peek(offset)?.text ?? '';
  }

  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  next(): PpToken {
    const token = this.tokens[this.index];
    if (!token) this.fail('unexpected end of the text');
    if (token.kind === 'identifier' && RESERVED_WORDS.has(token.text)) this.fail('Reserved word.');
    this.index += 1;
    return token;
  }

  /** Reads the token when its text is `text`. */
  accept(text: string): boolean {
    if (this.peekText() !== text || this.peek()?.kind === 'slot') return false;
    this.index += 1;
    return true;
  }

  expect(text: string): PpToken {
    if (this.peekText() !== text) this.fail(`expected '${text}'`);
    return this.next();
  }

  identifier(): PpToken {
    const token = this.peek();
    if (token?.kind !== 'identifier') this.fail('expected an identifier');
    return this.next();
  }

  mark(): number {
    return this.index;
  }

  reset(mark: number): void {
    this.index = mark;
  }

  position(): SourcePosition {
    return (this.peek() ?? this.tokens.at(-1))?.position ?? { file: '', line: 1, column: 1 };
  }

  fail(reason: string, at?: SourcePosition): never {
    const token = this.peek();
    throw new ShadingLanguageError(`'${token?.text ?? ''}' : ${reason}`, at ?? this.position());
  }
}
