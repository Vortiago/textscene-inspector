/**
 * The preprocessing tokens of a template variant, as glslang's scanner reads them
 * (`glslang/MachineIndependent/preprocessor/PpScanner.cpp`): identifiers, numbers with their
 * suffixes, punctuators, a token for each line end, and a token for each slot. A backslash at a
 * line's end joins the next line, and comments are white space.
 */

import { ShadingLanguageError, type SourcePosition } from '../language/shadingLanguageError.js';
import type { Slot, VariantLine } from './variant.js';

export type PpTokenKind = 'identifier' | 'number' | 'punctuator' | 'newline' | 'slot' | 'end';

export interface PpToken {
  readonly kind: PpTokenKind;
  /** The token's text: the name, the number with its suffix, or the punctuator. */
  readonly text: string;
  readonly position: SourcePosition;
  /** White space stands before the token on its line: `#define F(x)` and `#define F (x)` differ. */
  readonly space: boolean;
  readonly slot?: Slot;
}

/** glslang's punctuators of more than one character (`PpScanner.cpp:440-640`), longest first. */
const PUNCTUATORS = [
  '<<=',
  '>>=',
  '##',
  '++',
  '--',
  '&&',
  '||',
  '^^',
  '==',
  '!=',
  '<=',
  '>=',
  '<<',
  '>>',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
];

const isIdentifierStart = (char: string) => /^[A-Za-z_]$/.test(char);
const isIdentifierChar = (char: string) => /^[A-Za-z0-9_]$/.test(char);
const isDigit = (char: string) => char >= '0' && char <= '9';

/** The tokens of `lines`, ending with an `end` token. */
export function scanLines(lines: readonly VariantLine[]): PpToken[] {
  return new Scanner(lines).tokens();
}

class Scanner {
  private readonly out: PpToken[] = [];
  /** Set while a `/* ... *\/` comment runs past a line's end. */
  private inBlockComment = false;
  /** Set after a line that ends with a backslash, whose logical line goes on. */
  private continues = false;

  constructor(private readonly lines: readonly VariantLine[]) {}

  tokens(): PpToken[] {
    for (const line of this.lines) {
      if (line.slot) {
        this.endLogicalLine(line);
        this.out.push({
          kind: 'slot',
          text: '',
          slot: line.slot,
          position: positionOf(line, 1),
          space: false,
        });
        this.push(line, 'newline', '', 1, false);
        continue;
      }
      this.scanLine(line);
    }
    const last = this.lines.at(-1);
    const position = last ? positionOf(last, 1) : { file: '', line: 1, column: 1 };
    this.out.push({ kind: 'end', text: '', position, space: false });
    return this.out;
  }

  /** Closes a logical line that a backslash left open before a slot. */
  private endLogicalLine(line: VariantLine): void {
    if (!this.continues) return;
    this.continues = false;
    this.push(line, 'newline', '', 1, false);
  }

  private scanLine(line: VariantLine & { text: string }): void {
    const text = line.text;
    let index = 0;
    let space = this.continues;
    this.continues = false;
    while (index < text.length) {
      if (this.inBlockComment) {
        const end = text.indexOf('*/', index);
        if (end === -1) return this.endLine(line, text.length);
        this.inBlockComment = false;
        index = end + 2;
        space = true;
        continue;
      }
      const char = text[index]!;
      if (char === ' ' || char === '\t' || char === '\r' || char === '\f' || char === '\v') {
        index += 1;
        space = true;
        continue;
      }
      if (char === '\\' && index === text.length - 1) {
        this.continues = true;
        return;
      }
      if (text.startsWith('//', index)) break;
      if (text.startsWith('/*', index)) {
        this.inBlockComment = true;
        index += 2;
        space = true;
        continue;
      }
      index = this.scanToken(line, text, index, space);
      space = false;
    }
    this.endLine(line, text.length);
  }

  /** The line's end, unless a block comment carries the logical line on. */
  private endLine(line: VariantLine, length: number): void {
    if (this.inBlockComment) return;
    this.push(line, 'newline', '', length + 1, false);
  }

  /** Reads one token at `start` and gives the index after it. */
  private scanToken(line: VariantLine, text: string, start: number, space: boolean): number {
    const char = text[start]!;
    if (isIdentifierStart(char)) {
      let end = start + 1;
      while (end < text.length && isIdentifierChar(text[end]!)) end += 1;
      this.push(line, 'identifier', text.slice(start, end), start + 1, space);
      return end;
    }
    if (isDigit(char) || (char === '.' && isDigit(text[start + 1] ?? ''))) {
      const end = numberEnd(text, start);
      this.push(line, 'number', text.slice(start, end), start + 1, space);
      return end;
    }
    const punctuator = PUNCTUATORS.find((candidate) => text.startsWith(candidate, start)) ?? char;
    if (!/^[-+*/%<>=!&|^~?:;,.()[\]{}#]+$/.test(punctuator))
      throw new ShadingLanguageError(`'${char}' : unexpected character`, positionOf(line, start + 1));
    this.push(line, 'punctuator', punctuator, start + 1, space);
    return start + punctuator.length;
  }

  private push(line: VariantLine, kind: PpTokenKind, text: string, column: number, space: boolean): void {
    this.out.push({ kind, text, position: positionOf(line, column), space });
  }
}

const positionOf = (line: VariantLine, column: number): SourcePosition => ({
  file: line.file,
  line: line.line,
  column,
});

/**
 * The end of a number at `start`: digits, a hexadecimal prefix, a fraction, an exponent and a
 * suffix, as glslang's `lFloatConst` and `scan` read them (`PpScanner.cpp:96`, `:345`).
 */
function numberEnd(text: string, start: number): number {
  let end = start;
  const hex = /^0[xX]/.test(text.slice(start));
  if (hex) {
    end += 2;
    while (/[0-9a-fA-F]/.test(text[end] ?? '')) end += 1;
  } else {
    while (isDigit(text[end] ?? '')) end += 1;
    if (text[end] === '.') {
      end += 1;
      while (isDigit(text[end] ?? '')) end += 1;
    }
    if (/[eE]/.test(text[end] ?? '') && /^[eE][+-]?\d/.test(text.slice(end))) {
      end += 2;
      while (isDigit(text[end] ?? '')) end += 1;
    }
  }
  const suffix = /^(?:lf|LF|hf|HF|[fFuU]|u?l|U?L|ul|UL)?/.exec(text.slice(end))![0];
  return end + suffix.length;
}
