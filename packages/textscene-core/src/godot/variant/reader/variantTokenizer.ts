import { htmlColor } from '../../math/color.js';
import { storedReal } from '../../math/real.js';
import { hexDigitCodeValue, isDigitCode, isHexDigitCode } from '../../string/charUtils.js';
import { stringToFloat } from '../../string/strtod.js';
import { INT64_MAX, INT64_MIN } from '../cInteger.js';
import { variant, type VariantOf } from '../value/variant.js';

export type Punctuation = '{' | '}' | '[' | ']' | '(' | ')' | ':' | ',' | '.' | '=';

/** `VariantParser::Token` (variant_parser.h:115). An error token ends every parse that reads it. */
export type Token =
  | { readonly kind: Punctuation | 'eof' | 'error' }
  | { readonly kind: 'identifier'; readonly value: string }
  | { readonly kind: 'string' | 'string_name'; readonly value: string }
  | { readonly kind: 'number'; readonly value: VariantOf<'INT'> | VariantOf<'FLOAT'> }
  | { readonly kind: 'color'; readonly value: VariantOf<'COLOR'> };

const PUNCTUATION = new Set<string>(['{', '}', '[', ']', '(', ')', ':', ',', '.', '=']);
const ERROR: Token = { kind: 'error' };
const EOF: Token = { kind: 'eof' };
const REPLACEMENT_CHARACTER = 0xfffd;

/** `\b \t \n \f \r`, by the code point after the backslash. */
const SIMPLE_ESCAPES: Readonly<Record<number, number>> = { 0x62: 8, 0x74: 9, 0x6e: 10, 0x66: 12, 0x72: 13 };

const isIdentifierStart = (code: number) =>
  (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f;

// `String::append_utf32` (ustring.cpp:185) stores U+FFFD for a NUL, a surrogate or a code past U+10FFFF.
const appendedCodePoint = (code: number) =>
  code === 0 || (code & 0xfffff800) === 0xd800 || code > 0x10ffff ? REPLACEMENT_CHARACTER : code;

/** `String::to_int(const char32_t *)` (ustring.cpp:2616) over a token's digits, with its overflow return. */
function tokenInt(text: string): bigint {
  const negative = text.startsWith('-');
  let integer = 0n;
  for (const digit of negative ? text.slice(1) : text) {
    if (integer > INT64_MAX / 10n) return negative ? INT64_MIN : INT64_MAX;
    integer = BigInt.asIntN(64, integer * 10n + BigInt(digit));
  }
  return BigInt.asIntN(64, negative ? -integer : integer);
}

/** `Color::html` (color.cpp:331): a code of any other length gives `Color()`. */
function htmlTokenColor(text: string): VariantOf<'COLOR'> {
  const { r, g, b, a } = htmlColor(text) ?? { r: 0, g: 0, b: 0, a: 1 };
  return variant('COLOR', { r: storedReal(r), g: storedReal(g), b: storedReal(b), a: storedReal(a) });
}

/** `VariantParser::StreamString` (variant_parser.cpp:94) over a text, with `get_token` (:161) over it. */
export class VariantTokenizer {
  readonly #codes: readonly number[];
  #position = 0;
  #saved = 0;
  #isEof = false;

  constructor(text: string) {
    this.#codes = Array.from(text, (character) => character.codePointAt(0)!);
  }

  get isEof(): boolean {
    return this.#isEof;
  }

  #nextCode(): number {
    if (this.#position < this.#codes.length) return this.#codes[this.#position++]!;
    this.#isEof = true;
    return 0;
  }

  #takeSaved(): number {
    const saved = this.#saved;
    this.#saved = 0;
    return saved;
  }

  next(): Token {
    for (;;) {
      let code = this.#takeSaved();
      if (code === 0) {
        code = this.#nextCode();
        if (this.#isEof) return EOF;
      }
      if (code === 0) return EOF;
      const character = String.fromCodePoint(code);
      if (PUNCTUATION.has(character)) return { kind: character as Punctuation };
      if (code === 0x3b) {
        if (!this.#skipComment()) return EOF;
        continue;
      }
      if (code === 0x23) return this.#color();
      if (code === 0x26 || code === 0x40) {
        if (this.#nextCode() !== 0x22) return ERROR;
        return this.#string('string_name');
      }
      if (code === 0x22) return this.#string('string');
      if (code <= 32) continue;
      return this.#word(code);
    }
  }

  #skipComment(): boolean {
    for (;;) {
      const code = this.#nextCode();
      if (this.#isEof) return false;
      if (code === 0x0a) return true;
    }
  }

  #color(): Token {
    let text = '#';
    for (;;) {
      const code = this.#nextCode();
      if (this.#isEof) return EOF;
      if (!isHexDigitCode(code)) {
        this.#saved = code;
        return { kind: 'color', value: htmlTokenColor(text) };
      }
      text += String.fromCodePoint(code);
    }
  }

  #escaped(): number | undefined {
    const next = this.#nextCode();
    if (next === 0) return undefined;
    if (SIMPLE_ESCAPES[next] !== undefined) return SIMPLE_ESCAPES[next];
    if (next !== 0x75 && next !== 0x55) return next;
    let value = 0;
    for (let digit = 0; digit < (next === 0x55 ? 6 : 4); digit++) {
      const code = this.#nextCode();
      if (code === 0 || !isHexDigitCode(code)) return undefined;
      value = (value << 4) | hexDigitCodeValue(code)!;
    }
    return value;
  }

  // A lead surrogate escape waits for a trail escape: anything else between them is an error.
  #string(kind: 'string' | 'string_name'): Token {
    let text = '';
    let lead = 0;
    for (;;) {
      const code = this.#nextCode();
      if (code === 0) return ERROR;
      if (code === 0x22) break;
      if (code !== 0x5c) {
        if (lead !== 0) return ERROR;
        text += String.fromCodePoint(code);
        continue;
      }
      let value = this.#escaped();
      if (value === undefined) return ERROR;
      if ((value & 0xfffffc00) === 0xd800) {
        if (lead !== 0) return ERROR;
        lead = value;
        continue;
      }
      if ((value & 0xfffffc00) === 0xdc00) {
        if (lead === 0) return ERROR;
        value = ((lead - 0xd800) << 10) + (value - 0xdc00) + 0x10000;
        lead = 0;
      }
      if (lead !== 0) return ERROR;
      text += String.fromCodePoint(appendedCodePoint(value));
    }
    return lead === 0 ? { kind, value: text } : ERROR;
  }

  #word(first: number): Token {
    let text = '';
    let code = first;
    if (code === 0x2d) {
      text = '-';
      code = this.#nextCode();
    }
    if (isDigitCode(code)) return this.#number(text, code);
    if (!isIdentifierStart(code)) return ERROR;
    while (isIdentifierStart(code) || isDigitCode(code)) {
      text += String.fromCodePoint(code);
      code = this.#nextCode();
    }
    this.#saved = code;
    return { kind: 'identifier', value: text };
  }

  // The reading states of get_token's number (variant_parser.cpp:470): an exponent takes one sign first.
  #number(prefix: string, first: number): Token {
    let text = prefix;
    let code = first;
    let reading: 'int' | 'decimal' | 'exponent' = 'int';
    let isFloat = false;
    let hasExponentSign = false;
    let hasExponentDigit = false;
    for (; ; code = this.#nextCode()) {
      const character = String.fromCodePoint(code);
      if (reading === 'exponent') {
        if (isDigitCode(code)) hasExponentDigit = true;
        else if ((character === '-' || character === '+') && !hasExponentSign && !hasExponentDigit)
          hasExponentSign = true;
        else break;
      } else if (isDigitCode(code)) {
        // A digit stays in the int or the decimal part.
      } else if (character === 'e' || character === 'E') {
        reading = 'exponent';
        isFloat = true;
      } else if (character === '.' && reading === 'int') {
        reading = 'decimal';
        isFloat = true;
      } else break;
      text += character;
    }
    this.#saved = code;
    const value = isFloat ? variant('FLOAT', stringToFloat(text)) : variant('INT', tokenInt(text));
    return { kind: 'number', value };
  }
}
