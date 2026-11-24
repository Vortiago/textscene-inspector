import { describe, expect, it } from 'vitest';
import { VariantTokenizer, type Token } from './variantTokenizer';

const tokens = (text: string): Token[] => {
  const tokenizer = new VariantTokenizer(text);
  const read: Token[] = [];
  for (let token = tokenizer.next(); token.kind !== 'eof' && token.kind !== 'error'; token = tokenizer.next())
    read.push(token);
  return read;
};

const first = (text: string) => new VariantTokenizer(text).next();

// Each token is what Godot 4.6.3's VariantParser::get_token reads, measured through str_to_var.
describe('VariantTokenizer.next', () => {
  it('reads punctuation, identifiers and numbers, skipping blanks and comments', () => {
    expect(tokens('Vector2 ( 1 ; note\n, -2.5 )').map((token) => token.kind)).toEqual([
      'identifier',
      '(',
      'number',
      ',',
      'number',
      ')',
    ]);
  });

  it('clamps an integer past int64 to the end it overflows toward', () => {
    expect(first('99999999999999999999')).toEqual({
      kind: 'number',
      value: { type: 'INT', value: 2n ** 63n - 1n },
    });
  });

  it('wraps a 19-digit integer the overflow test misses (edge case)', () => {
    expect(first('9223372036854775808')).toEqual({
      kind: 'number',
      value: { type: 'INT', value: -(2n ** 63n) },
    });
  });

  it('joins a UTF-16 pair of escapes into one code point', () => {
    expect(first(String.raw`"😀"`)).toEqual({ kind: 'string', value: '😀' });
  });

  it('refuses a lead surrogate with no trail', () => {
    expect(first(String.raw`"\ud83dx"`).kind).toBe('error');
  });

  it('stores U+FFFD for an escaped NUL (edge case)', () => {
    expect(first(String.raw`"\u0000"`)).toEqual({ kind: 'string', value: '�' });
  });

  it('reads a colour that the end of the text cuts as the end of the text (edge case)', () => {
    expect(first('#fff').kind).toBe('eof');
    expect(first('#fff ').kind).toBe('color');
  });
});
