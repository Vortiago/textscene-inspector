/**
 * The tokenizer of Godot's shading language: a port of `ShaderLanguage::_get_token`
 * (`servers/rendering/shader_language.cpp:407`). Keywords come from the instruction table, so a
 * keyword Godot adds is one row there. A text Godot refuses throws `ShadingLanguageError` with
 * Godot's message.
 */

import { KEYWORD_TOKENS } from './instructions.js';
import { ShadingLanguageError } from './shadingLanguageError.js';

export interface Token {
  /** Godot's token name, `TK_FLOAT_CONSTANT` and the rest. */
  readonly type: string;
  /** The identifier, the number as Godot reads it (lower case, suffix stripped), or the string. */
  readonly text?: string;
  readonly line: number;
}

/**
 * The operator and punctuation tokens, longest first, from the character switch of `_get_token`
 * (`shader_language.cpp:412-708`).
 */
const SYMBOLS: readonly (readonly [string, string])[] = [
  ['<<=', 'TK_OP_ASSIGN_SHIFT_LEFT'],
  ['>>=', 'TK_OP_ASSIGN_SHIFT_RIGHT'],
  ['/=', 'TK_OP_ASSIGN_DIV'],
  ['==', 'TK_OP_EQUAL'],
  ['<=', 'TK_OP_LESS_EQUAL'],
  ['<<', 'TK_OP_SHIFT_LEFT'],
  ['>=', 'TK_OP_GREATER_EQUAL'],
  ['>>', 'TK_OP_SHIFT_RIGHT'],
  ['!=', 'TK_OP_NOT_EQUAL'],
  ['^=', 'TK_OP_ASSIGN_BIT_XOR'],
  ['&=', 'TK_OP_ASSIGN_BIT_AND'],
  ['&&', 'TK_OP_AND'],
  ['|=', 'TK_OP_ASSIGN_BIT_OR'],
  ['||', 'TK_OP_OR'],
  ['*=', 'TK_OP_ASSIGN_MUL'],
  ['+=', 'TK_OP_ASSIGN_ADD'],
  ['++', 'TK_OP_INCREMENT'],
  ['-=', 'TK_OP_ASSIGN_SUB'],
  ['--', 'TK_OP_DECREMENT'],
  ['%=', 'TK_OP_ASSIGN_MOD'],
  ['/', 'TK_OP_DIV'],
  ['=', 'TK_OP_ASSIGN'],
  ['<', 'TK_OP_LESS'],
  ['>', 'TK_OP_GREATER'],
  ['!', 'TK_OP_NOT'],
  ['{', 'TK_CURLY_BRACKET_OPEN'],
  ['}', 'TK_CURLY_BRACKET_CLOSE'],
  ['[', 'TK_BRACKET_OPEN'],
  [']', 'TK_BRACKET_CLOSE'],
  ['(', 'TK_PARENTHESIS_OPEN'],
  [')', 'TK_PARENTHESIS_CLOSE'],
  [',', 'TK_COMMA'],
  [';', 'TK_SEMICOLON'],
  ['?', 'TK_QUESTION'],
  [':', 'TK_COLON'],
  ['^', 'TK_OP_BIT_XOR'],
  ['~', 'TK_OP_BIT_INVERT'],
  ['&', 'TK_OP_BIT_AND'],
  ['|', 'TK_OP_BIT_OR'],
  ['*', 'TK_OP_MUL'],
  ['+', 'TK_OP_ADD'],
  ['-', 'TK_OP_SUB'],
  ['%', 'TK_OP_MOD'],
];

const isDigit = (char: string) => char >= '0' && char <= '9';
const isHexDigit = (char: string) => isDigit(char) || (char >= 'a' && char <= 'f');
const isIdentifierChar = (char: string) => /^[A-Za-z0-9_]$/.test(char);

/** Every token of `source`, ending with `TK_EOF`. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const cursor = { index: 0, line: 1 };
  for (;;) {
    const token = nextToken(source, cursor);
    tokens.push(token);
    if (token.type === 'TK_EOF') return tokens;
  }
}

interface Cursor {
  index: number;
  line: number;
}

function nextToken(source: string, cursor: Cursor): Token {
  for (;;) {
    const char = source[cursor.index];
    if (char === undefined) return { type: 'TK_EOF', line: cursor.line };
    if (char === '\n') {
      cursor.line += 1;
      cursor.index += 1;
      continue;
    }
    if (char === ' ' || char === '\t' || char === '\r') {
      cursor.index += 1;
      continue;
    }
    if (source.startsWith('//', cursor.index) || source.startsWith('/*', cursor.index)) {
      if (!skipComment(source, cursor)) return { type: 'TK_EOF', line: cursor.line };
      continue;
    }
    return readToken(source, cursor, char);
  }
}

/** Skips the comment at the cursor. Answers false when the text ends inside it. */
function skipComment(source: string, cursor: Cursor): boolean {
  const block = source[cursor.index + 1] === '*';
  cursor.index += 2;
  for (;;) {
    const char = source[cursor.index];
    if (char === undefined) return false;
    if (block && source.startsWith('*/', cursor.index)) {
      cursor.index += 2;
      return true;
    }
    cursor.index += 1;
    if (char === '\n') {
      cursor.line += 1;
      if (!block) return true;
    }
  }
}

function readToken(source: string, cursor: Cursor, char: string): Token {
  const line = cursor.line;
  if (char === '"') return readString(source, cursor);
  if (char === '@') {
    throw new ShadingLanguageError(
      'An include marker comes from the preprocessor, which is not translated yet (#1828)',
      line
    );
  }
  if (isDigit(char) || (char === '.' && isDigit(source[cursor.index + 1] ?? '')))
    return readNumber(source, cursor);
  if (char === '.') {
    cursor.index += 1;
    return { type: 'TK_PERIOD', line };
  }
  if (isIdentifierChar(char)) return readIdentifier(source, cursor);
  const symbol = SYMBOLS.find(([text]) => source.startsWith(text, cursor.index));
  if (symbol) {
    cursor.index += symbol[0].length;
    return { type: symbol[1], line };
  }
  const code = char.codePointAt(0)!;
  throw new ShadingLanguageError(
    code > 32 ? `Tokenizer: Unknown character #${code}: '${char}'` : `Tokenizer: Unknown character #${code}`,
    line
  );
}

function readIdentifier(source: string, cursor: Cursor): Token {
  const start = cursor.index;
  while (isIdentifierChar(source[cursor.index] ?? '')) cursor.index += 1;
  const text = source.slice(start, cursor.index);
  const keyword = KEYWORD_TOKENS.get(text);
  if (keyword) return { type: keyword, line: cursor.line };
  // `shader_language.cpp:960`: Godot renames this prefix, which its compiler gives its own names.
  return { type: 'TK_IDENTIFIER', text: text.replace('dus_', '_'), line: cursor.line };
}

/** `"..."` with `\"` and `\\` as its only escapes (`shader_language.cpp:520`). */
function readString(source: string, cursor: Cursor): Token {
  const line = cursor.line;
  let content = '';
  let backslash = false;
  for (cursor.index += 1; ; cursor.index += 1) {
    const char = source[cursor.index];
    if (char === undefined) throw new ShadingLanguageError('EOF reached before string termination.', line);
    if (char === '\n') throw new ShadingLanguageError('Unexpected end of string.', line);
    if (char === '"' && !backslash) {
      cursor.index += 1;
      return { type: 'TK_STRING_CONSTANT', text: content, line };
    }
    if (char === '\\') {
      if (backslash) content += '\\';
      backslash = !backslash;
      continue;
    }
    if (char === '"') content += '"';
    else if (backslash)
      throw new ShadingLanguageError('Only \\" and \\\\ escape characters supported.', line);
    else content += char;
    backslash = false;
  }
}

/** Where a number's next character may be a suffix, by what came before (`shader_language.cpp:727`). */
type SuffixCase = 'all' | 'hexOrPeriod' | 'exponent' | 'signAfterExponent' | 'none';

const SUFFIXES: Record<SuffixCase, string> = {
  all: '.xefu-+',
  hexOrPeriod: 'efu',
  exponent: 'f-+',
  signAfterExponent: 'f',
  none: '',
};

interface NumberShape {
  hex: boolean;
  period: boolean;
  exponent: boolean;
  floatSuffix: boolean;
  uintSuffix: boolean;
}

/** The number at the cursor, read as `_get_token` reads it (`shader_language.cpp:711-882`). */
function readNumber(source: string, cursor: Cursor): Token {
  const line = cursor.line;
  const shape: NumberShape = {
    hex: false,
    period: false,
    exponent: false,
    floatSuffix: false,
    uintSuffix: false,
  };
  let suffixCase: SuffixCase = 'all';
  let endSuffix = false;
  let digitAfterExponent = false;
  let text = '';
  for (let offset = 0; ; offset += 1) {
    const symbol = (source[cursor.index + offset] ?? '').toLowerCase();
    let error = false;
    if (symbol !== '' && isDigit(symbol)) {
      if (shape.exponent) digitAfterExponent = true;
      if (endSuffix) error = true;
    } else if (symbol !== '' && SUFFIXES[suffixCase].includes(symbol)) {
      if (symbol === 'x') {
        shape.hex = true;
        suffixCase = 'hexOrPeriod';
      } else if (symbol === '.') {
        shape.period = true;
        suffixCase = 'hexOrPeriod';
      } else if (symbol === 'e' && !shape.hex) {
        shape.exponent = true;
        suffixCase = 'exponent';
      } else if (symbol === 'f' && !shape.hex) {
        if (!shape.period && !shape.exponent) error = true;
        shape.floatSuffix = true;
        endSuffix = true;
        suffixCase = 'none';
      } else if (symbol === 'u') {
        shape.uintSuffix = true;
        endSuffix = true;
        suffixCase = 'none';
      } else if (symbol === '-' || symbol === '+') {
        if (!shape.exponent) break;
        suffixCase = 'signAfterExponent';
      }
    } else if (!shape.hex || !isHexDigit(symbol)) {
      if (symbol !== '' && isIdentifierChar(symbol)) error = true;
      else break;
    }
    if (error) throw new ShadingLanguageError(numberError(shape), line);
    text += symbol;
  }
  cursor.index += text.length;
  return { type: numberType(shape), text: validNumberText(text, shape, digitAfterExponent, line), line };
}

function numberType(shape: NumberShape): string {
  if (shape.period || shape.exponent || shape.floatSuffix) return 'TK_FLOAT_CONSTANT';
  return shape.uintSuffix ? 'TK_UINT_CONSTANT' : 'TK_INT_CONSTANT';
}

function numberError(shape: NumberShape): string {
  if (shape.hex) return 'Invalid (hexadecimal) numeric constant';
  if (shape.period || shape.exponent || shape.floatSuffix) return 'Invalid (float) numeric constant';
  if (shape.uintSuffix) return 'Invalid (unsigned integer) numeric constant';
  return 'Invalid (integer) numeric constant';
}

/** The number's text with its suffix stripped, after the checks of `shader_language.cpp:820-864`. */
function validNumberText(
  text: string,
  shape: NumberShape,
  digitAfterExponent: boolean,
  line: number
): string {
  const fail = () => {
    throw new ShadingLanguageError(numberError(shape), line);
  };
  const last = text[text.length - 1] ?? '';
  const stripped = shape.floatSuffix || shape.uintSuffix ? text.slice(0, -1) : text;
  if (shape.hex) {
    if (stripped.length > 10 || !/^0x[0-9a-f]+$/.test(stripped)) fail();
    return stripped;
  }
  if (shape.period || shape.exponent || shape.floatSuffix) {
    if (shape.exponent && (!digitAfterExponent || (!isDigit(last) && last !== 'f'))) fail();
    if (shape.period && shape.floatSuffix && last !== 'f') fail();
    if (shape.period && !shape.floatSuffix && last !== '.' && !isDigit(last)) fail();
    if (!shape.period && shape.floatSuffix && last !== 'f') fail();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(stripped)) fail();
    return stripped;
  }
  if (!/^\d+$/.test(stripped)) fail();
  return stripped;
}
