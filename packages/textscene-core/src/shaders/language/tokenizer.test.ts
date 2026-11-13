/** The tokenizer, against what Godot's `_get_token` (`shader_language.cpp:407`) gives. */

import { describe, expect, it } from 'vitest';
import { ShadingLanguageError } from './shadingLanguageError.js';
import { tokenize } from './tokenizer.js';

const types = (source: string) => tokenize(source).map((token) => token.type);

describe('tokenize', () => {
  it('reads a function of float arithmetic', () => {
    expect(types('vec3 f(vec3 a) { return a.zyx * 2.0; }')).toEqual([
      'TK_TYPE_VEC3',
      'TK_IDENTIFIER',
      'TK_PARENTHESIS_OPEN',
      'TK_TYPE_VEC3',
      'TK_IDENTIFIER',
      'TK_PARENTHESIS_CLOSE',
      'TK_CURLY_BRACKET_OPEN',
      'TK_CF_RETURN',
      'TK_IDENTIFIER',
      'TK_PERIOD',
      'TK_IDENTIFIER',
      'TK_OP_MUL',
      'TK_FLOAT_CONSTANT',
      'TK_SEMICOLON',
      'TK_CURLY_BRACKET_CLOSE',
      'TK_EOF',
    ]);
  });

  it('skips line and block comments, and counts their lines and columns', () => {
    const tokens = tokenize('// one\n/* two\nthree */ x');
    expect(tokens.map((token) => [token.type, token.position.line, token.position.column])).toEqual([
      ['TK_IDENTIFIER', 3, 10],
      ['TK_EOF', 3, 11],
    ]);
  });

  it.each([
    ['1.0', 'TK_FLOAT_CONSTANT', '1.0'],
    ['1.f', 'TK_FLOAT_CONSTANT', '1.'],
    ['2.5f', 'TK_FLOAT_CONSTANT', '2.5'],
    ['.5', 'TK_FLOAT_CONSTANT', '.5'],
    ['1e+2', 'TK_FLOAT_CONSTANT', '1e+2'],
    ['1E2', 'TK_FLOAT_CONSTANT', '1e2'],
    ['7', 'TK_INT_CONSTANT', '7'],
    ['7u', 'TK_UINT_CONSTANT', '7'],
    ['0x1F', 'TK_INT_CONSTANT', '0x1f'],
  ])('reads the number %s', (source, type, text) => {
    const [token] = tokenize(source);
    expect([token?.type, token?.text]).toEqual([type, text]);
  });

  it.each([['2f'], ['1e'], ['1.0ef'], ['12abc']])('refuses the number %s, as Godot does', (source) => {
    expect(() => tokenize(source)).toThrow(/numeric constant/);
  });

  it('reads the two-character operators', () => {
    expect(types('+= ++ <<= == != && ||').slice(0, -1)).toEqual([
      'TK_OP_ASSIGN_ADD',
      'TK_OP_INCREMENT',
      'TK_OP_ASSIGN_SHIFT_LEFT',
      'TK_OP_EQUAL',
      'TK_OP_NOT_EQUAL',
      'TK_OP_AND',
      'TK_OP_OR',
    ]);
  });

  it('renames the dus_ prefix of an identifier, as Godot does', () => {
    expect(tokenize('dus_x')[0]?.text).toBe('_x');
  });

  it('renames every dus_ of an identifier, as Godot does', () => {
    expect(tokenize('a_dus_b_dus_c')[0]?.text).toBe('a__b__c');
  });

  it('refuses a character outside the language', () => {
    expect(() => tokenize('a $ b')).toThrow(/Unknown character/);
  });
});

describe('preprocessor directives', () => {
  it('refuses a directive as its row, with the issue that owns it', () => {
    let error: unknown;
    try {
      tokenize('#define X 1\nfloat f() { return 1.0; }');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ShadingLanguageError);
    expect((error as ShadingLanguageError).reason).toBe("'#define' is not transpiled yet (#1828)");
    expect((error as ShadingLanguageError).owner).toBe('#1828');
  });

  it("gives Godot's message for an unknown directive", () => {
    expect(() => tokenize('# frobnicate')).toThrow(/Unknown directive\./);
  });
});
