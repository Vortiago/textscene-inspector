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

  it('throws on a character no token starts with', () => {
    expect(() => tokensOf('@')).toThrow(new ExpressionError('Unexpected character.'));
  });

  it('answers EOF again at the end', () => {
    const tokenizer = new ExpressionTokenizer('');
    expect([tokenizer.token(), tokenizer.token()]).toEqual([{ type: 'EOF' }, { type: 'EOF' }]);
  });
});
