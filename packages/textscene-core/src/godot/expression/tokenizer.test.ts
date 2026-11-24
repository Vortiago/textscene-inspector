import { describe, expect, it } from 'vitest';
import { variant } from '../variant/value/variant.js';
import { ExpressionError, ExpressionTokenizer, type Token } from './tokenizer.js';

function tokensOf(text: string): Token[] {
  const tokenizer = new ExpressionTokenizer(text);
  const tokens: Token[] = [];
  for (let token = tokenizer.token(); token.type !== 'EOF'; token = tokenizer.token()) tokens.push(token);
  return tokens;
}

describe('ExpressionTokenizer', () => {
  it('reads a hexadecimal int and a float with an exponent', () => {
    expect(tokensOf('0x1F 1e3')).toEqual([
      { type: 'CONSTANT', value: variant('INT', 31n) },
      { type: 'CONSTANT', value: variant('FLOAT', 1000) },
    ]);
  });

  it('reads the escapes of a single-quoted string', () => {
    expect(tokensOf("'a\\tb'")).toEqual([{ type: 'CONSTANT', value: variant('STRING', 'a\tb') }]);
  });

  it('writes U+FFFD for an escape above U+10FFFF, as Godot 4.6.3 does', () => {
    expect(tokensOf('"\\UFFFFFF\\U110000"')).toEqual([
      { type: 'CONSTANT', value: variant('STRING', '\ufffd\ufffd') },
    ]);
  });

  it('writes U+FFFD for a NUL escape, as Godot 4.6.3 does', () => {
    expect(tokensOf('"a\\u0000b"')).toEqual([{ type: 'CONSTANT', value: variant('STRING', 'a\ufffdb') }]);
  });

  it('keeps the highest code point', () => {
    expect(tokensOf('"\\U10FFFF"')).toEqual([{ type: 'CONSTANT', value: variant('STRING', '\u{10ffff}') }]);
  });

  it('reads a string longer than the engine takes as arguments', () => {
    const long = 'a'.repeat(500_000);
    expect(tokensOf(`"${long}"`)).toEqual([{ type: 'CONSTANT', value: variant('STRING', long) }]);
  });

  it('throws on a character no token starts with', () => {
    expect(() => tokensOf('@')).toThrow(new ExpressionError('Unexpected character.'));
  });

  it('answers EOF again at the end', () => {
    const tokenizer = new ExpressionTokenizer('');
    expect([tokenizer.token(), tokenizer.token()]).toEqual([{ type: 'EOF' }, { type: 'EOF' }]);
  });
});
