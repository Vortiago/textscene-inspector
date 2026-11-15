import { binToInt64, hexToInt64 } from '../string/radixInteger.js';
import { stringToInt64 } from '../string/string.js';
import { godotStrtod } from '../string/strtod.js';
import { isUnicodeIdentifierContinue, isUnicodeIdentifierStart } from '../string/unicodeIdentifier.js';
import { UTILITY_FUNCTIONS } from '../variant/registrations.generated.js';
import { NIL, variant, type Variant, type VariantTypeName } from '../variant/value/variant.js';
import { VARIANT_TYPE, variantTypeName } from '../variant/variantType.js';

export type TokenType =
  | 'CURLY_BRACKET_OPEN'
  | 'CURLY_BRACKET_CLOSE'
  | 'BRACKET_OPEN'
  | 'BRACKET_CLOSE'
  | 'PARENTHESIS_OPEN'
  | 'PARENTHESIS_CLOSE'
  | 'IDENTIFIER'
  | 'BUILTIN_FUNC'
  | 'SELF'
  | 'CONSTANT'
  | 'BASIC_TYPE'
  | 'COLON'
  | 'COMMA'
  | 'PERIOD'
  | 'OP_IN'
  | 'OP_EQUAL'
  | 'OP_NOT_EQUAL'
  | 'OP_LESS'
  | 'OP_LESS_EQUAL'
  | 'OP_GREATER'
  | 'OP_GREATER_EQUAL'
  | 'OP_AND'
  | 'OP_OR'
  | 'OP_NOT'
  | 'OP_ADD'
  | 'OP_SUB'
  | 'OP_MUL'
  | 'OP_DIV'
  | 'OP_MOD'
  | 'OP_POW'
  | 'OP_SHIFT_LEFT'
  | 'OP_SHIFT_RIGHT'
  | 'OP_BIT_AND'
  | 'OP_BIT_OR'
  | 'OP_BIT_XOR'
  | 'OP_BIT_INVERT'
  | 'INPUT'
  | 'EOF'
  | 'ERROR';

export type Token =
  | { readonly type: 'CONSTANT'; readonly value: Variant }
  | { readonly type: 'BASIC_TYPE'; readonly value: VariantTypeName }
  | { readonly type: 'IDENTIFIER' | 'BUILTIN_FUNC'; readonly value: string }
  | { readonly type: 'INPUT'; readonly value: number }
  | {
      readonly type: Exclude<TokenType, 'CONSTANT' | 'BASIC_TYPE' | 'IDENTIFIER' | 'BUILTIN_FUNC' | 'INPUT'>;
    };

const END = '\0';

const UTILITY_NAMES = new Set(UTILITY_FUNCTIONS.map(([name]) => name));

const TYPES_BY_NAME = new Map(
  (Object.keys(VARIANT_TYPE) as VariantTypeName[]).map((type) => [variantTypeName(VARIANT_TYPE[type])!, type])
);

const CONSTANT_WORDS: Readonly<Record<string, Variant>> = {
  null: NIL,
  true: variant('BOOL', true),
  false: variant('BOOL', false),
  PI: variant('FLOAT', Math.PI),
  TAU: variant('FLOAT', 2 * Math.PI),
  INF: variant('FLOAT', Infinity),
  NAN: variant('FLOAT', NaN),
};

const WORD_TOKENS: Readonly<Record<string, Token['type']>> = {
  in: 'OP_IN',
  not: 'OP_NOT',
  or: 'OP_OR',
  and: 'OP_AND',
  self: 'SELF',
};

const SINGLE_CHARACTER_TOKENS: Readonly<Record<string, Token['type']>> = {
  '{': 'CURLY_BRACKET_OPEN',
  '}': 'CURLY_BRACKET_CLOSE',
  '[': 'BRACKET_OPEN',
  ']': 'BRACKET_CLOSE',
  '(': 'PARENTHESIS_OPEN',
  ')': 'PARENTHESIS_CLOSE',
  ',': 'COMMA',
  ':': 'COLON',
  '+': 'OP_ADD',
  '-': 'OP_SUB',
  '/': 'OP_DIV',
  '%': 'OP_MOD',
  '^': 'OP_BIT_XOR',
  '~': 'OP_BIT_INVERT',
};

// A second character that makes a longer token, keyed by the first.
const PAIRED_TOKENS: Readonly<
  Record<string, readonly [Token['type'], Readonly<Record<string, Token['type']>>]>
> = {
  '!': ['OP_NOT', { '=': 'OP_NOT_EQUAL' }],
  '>': ['OP_GREATER', { '=': 'OP_GREATER_EQUAL', '>': 'OP_SHIFT_RIGHT' }],
  '<': ['OP_LESS', { '=': 'OP_LESS_EQUAL', '<': 'OP_SHIFT_LEFT' }],
  '*': ['OP_MUL', { '*': 'OP_POW' }],
  '&': ['OP_BIT_AND', { '&': 'OP_AND' }],
  '|': ['OP_BIT_OR', { '|': 'OP_OR' }],
};

const ESCAPES: Readonly<Record<string, number>> = { b: 8, t: 9, n: 10, f: 12, r: 13 };

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isHexDigit = (char: string): boolean => /^[0-9a-fA-F]$/.test(char);
const isBinaryDigit = (char: string): boolean => char === '0' || char === '1';

export class ExpressionError extends Error {}

const fail = (message: string): never => {
  throw new ExpressionError(message);
};

/** The tokenizer of expression.cpp:34, over the code points of the text. */
export class ExpressionTokenizer {
  private readonly chars: readonly string[];
  offset = 0;

  constructor(text: string) {
    this.chars = Array.from(text);
  }

  private at(offset: number): string {
    return this.chars[offset] ?? END;
  }

  // GET_CHAR: at the end it answers 0 and the offset stays.
  private next(): string {
    return this.offset >= this.chars.length ? END : this.chars[this.offset++]!;
  }

  token(): Token {
    for (;;) {
      const char = this.next();
      if (char === END) return { type: 'EOF' };
      const single = SINGLE_CHARACTER_TOKENS[char];
      if (single) return { type: single } as Token;
      const paired = PAIRED_TOKENS[char];
      if (paired) return this.paired(paired);
      if (char === '$') return this.input();
      if (char === '=') return this.next() === '=' ? { type: 'OP_EQUAL' } : fail("Expected '='");
      if (char === '"' || char === "'")
        return { type: 'CONSTANT', value: variant('STRING', this.string(char)) };
      if (char.codePointAt(0)! <= 32) continue;
      if (isDigit(char) || (char === '.' && isDigit(this.at(this.offset)))) return this.number(char);
      if (isUnicodeIdentifierStart(char)) return this.word(char);
      if (char === '.') return { type: 'PERIOD' };
      return fail('Unexpected character.');
    }
  }

  private paired([single, longer]: readonly [Token['type'], Readonly<Record<string, Token['type']>>]): Token {
    const type = longer[this.at(this.offset)];
    if (type === undefined) return { type: single } as Token;
    this.offset += 1;
    return { type } as Token;
  }

  private input(): Token {
    let index = 0;
    do {
      if (!isDigit(this.at(this.offset))) fail("Expected number after '$'");
      index = index * 10 + Number(this.at(this.offset));
      this.offset += 1;
    } while (isDigit(this.at(this.offset)));
    return { type: 'INPUT', value: index };
  }

  private string(quote: string): string {
    const codes: number[] = [];
    let lead = 0;
    for (;;) {
      const char = this.next();
      if (char === END) fail('Unterminated String');
      if (char === quote) break;
      if (char !== '\\') {
        if (lead !== 0) fail('Invalid UTF-16 sequence in string, unpaired lead surrogate');
        codes.push(char.codePointAt(0)!);
        continue;
      }
      let code = this.escape();
      if ((code & 0xfffffc00) === 0xd800) {
        if (lead !== 0) fail('Invalid UTF-16 sequence in string, unpaired lead surrogate');
        lead = code;
        continue;
      }
      if ((code & 0xfffffc00) === 0xdc00) {
        if (lead === 0) fail('Invalid UTF-16 sequence in string, unpaired trail surrogate');
        code = (lead << 10) + code - ((0xd800 << 10) + 0xdc00 - 0x10000);
        lead = 0;
      }
      if (lead !== 0) fail('Invalid UTF-16 sequence in string, unpaired lead surrogate');
      codes.push(code);
    }
    if (lead !== 0) fail('Invalid UTF-16 sequence in string, unpaired lead surrogate');
    return String.fromCodePoint(...codes);
  }

  private escape(): number {
    const next = this.next();
    if (next === END) fail('Unterminated String');
    const known = ESCAPES[next];
    if (known !== undefined) return known;
    if (next !== 'u' && next !== 'U') return next.codePointAt(0)!;
    let code = 0;
    for (let index = 0; index < (next === 'U' ? 6 : 4); index += 1) {
      const digit = this.next();
      if (digit === END) fail('Unterminated String');
      if (!isHexDigit(digit)) fail('Malformed hex constant in string');
      code = (code << 4) | Number.parseInt(digit, 16);
    }
    return code;
  }

  // expression.cpp:328, a state machine whose text goes to the String number readers.
  private number(first: string): Token {
    const nextChar = this.at(this.offset);
    let reading: 'INT' | 'HEX' | 'BIN' | 'DEC' | 'EXP' | 'DONE' = 'INT';
    let char = first;
    let text = '';
    let hasExponentSign = false;
    let hasExponentDigit = false;
    let hasBinaryPrefix = false;
    let hasHexPrefix = false;
    let isFloat = false;
    let isFirst = true;
    for (;;) {
      if (reading === 'INT') {
        if (isDigit(char)) {
          if (isFirst && char === '0') {
            if (nextChar === 'b' || nextChar === 'B') reading = 'BIN';
            else if (nextChar === 'x' || nextChar === 'X') reading = 'HEX';
          }
        } else if (char === '.') {
          reading = 'DEC';
          isFloat = true;
        } else if (char === 'e' || char === 'E') {
          reading = 'EXP';
          isFloat = true;
        } else reading = 'DONE';
      } else if (reading === 'BIN') {
        if (hasBinaryPrefix && !isBinaryDigit(char)) reading = 'DONE';
        else if (char === 'b' || char === 'B') hasBinaryPrefix = true;
      } else if (reading === 'HEX') {
        if (hasHexPrefix && !isHexDigit(char)) reading = 'DONE';
        else if (char === 'x' || char === 'X') hasHexPrefix = true;
      } else if (reading === 'DEC') {
        if (char === 'e' || char === 'E') reading = 'EXP';
        else if (!isDigit(char)) reading = 'DONE';
      } else if (reading === 'EXP') {
        if (isDigit(char)) hasExponentDigit = true;
        else if ((char === '-' || char === '+') && !hasExponentSign && !hasExponentDigit)
          hasExponentSign = true;
        else reading = 'DONE';
      }
      if (reading === 'DONE') break;
      text += char;
      char = this.next();
      isFirst = false;
    }
    if (char !== END) this.offset -= 1;
    return { type: 'CONSTANT', value: numberValue(text, isFloat, hasBinaryPrefix, hasHexPrefix) };
  }

  private word(first: string): Token {
    let id = first;
    let char = this.next();
    while (isUnicodeIdentifierContinue(char)) {
      id += char;
      char = this.next();
    }
    // Godot steps back even after the end, so the last character is read again (expression.cpp:446).
    this.offset -= 1;
    const word = WORD_TOKENS[id];
    if (word) return { type: word } as Token;
    const constant = CONSTANT_WORDS[id];
    if (constant) return { type: 'CONSTANT', value: constant };
    const type = TYPES_BY_NAME.get(id);
    if (type) return { type: 'BASIC_TYPE', value: type };
    if (UTILITY_NAMES.has(id)) return { type: 'BUILTIN_FUNC', value: id };
    return { type: 'IDENTIFIER', value: id };
  }
}

function numberValue(text: string, isFloat: boolean, isBinary: boolean, isHex: boolean): Variant {
  if (isFloat) return variant('FLOAT', godotStrtod(text));
  if (isBinary) return variant('INT', binToInt64(text));
  if (isHex) return variant('INT', hexToInt64(text));
  return variant('INT', stringToInt64(text));
}
