import { describe, expect, it } from 'vitest';
import { preprocess } from './preprocess.js';
import type { VariantLine } from './variant.js';

const linesOf = (text: string): VariantLine[] =>
  text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
const tokensOf = (text: string) =>
  preprocess(linesOf(text))
    .tokens.map((token) => token.text)
    .join(' ');

describe('preprocess', () => {
  it('expands an object-like macro', () => {
    expect(tokensOf('#define N 4\nfloat a[N];')).toBe('float a [ 4 ] ;');
  });

  it('expands a function-like macro with its arguments expanded first', () => {
    expect(tokensOf('#define N 4\n#define TWICE(x) (x + x)\nTWICE(N)')).toBe('( 4 + 4 )');
  });

  it('leaves a function-like macro name alone when no parenthesis follows', () => {
    expect(tokensOf('#define F(x) x\nF + 1')).toBe('F + 1');
  });

  it('expands no macro inside its own expansion', () => {
    expect(tokensOf('#define A A + 1\nA')).toBe('A + 1');
  });

  it('reads the branch whose condition holds', () => {
    expect(tokensOf('#define MODE 2\n#if MODE == 1\none\n#elif MODE == 2\ntwo\n#else\nother\n#endif')).toBe(
      'two'
    );
  });

  it('reads an undefined name in a condition as 0', () => {
    expect(tokensOf('#if UNDEFINED\nyes\n#else\nno\n#endif')).toBe('no');
  });

  it('resolves defined before it expands a macro', () => {
    expect(tokensOf('#define A\n#if defined(A) && !defined B\nyes\n#endif')).toBe('yes');
  });

  it('applies a unary operator to its operand only', () => {
    expect(tokensOf('#if -1 + 2 == 1\nyes\n#endif')).toBe('yes');
  });

  it('records each branch it decides and whether it is read', () => {
    const { branches } = preprocess(linesOf('#ifdef A\na\n#else\nb\n#endif'));
    expect(branches.map(({ line, directive, isTaken }) => [line, directive, isTaken])).toEqual([
      [1, 'ifdef', false],
      [3, 'else', true],
    ]);
  });

  it('decides no branch inside a branch it does not read', () => {
    const { branches } = preprocess(linesOf('#ifdef A\n#ifdef B\n#endif\n#endif'));
    expect(branches).toHaveLength(1);
  });

  it('keeps the version, extension and pragma directives for the parser', () => {
    const { directives } = preprocess(linesOf('#version 450\n#extension GL_EXT_multiview : enable'));
    expect(directives.map(({ name, text }) => [name, text])).toEqual([
      ['version', '450'],
      ['extension', 'GL_EXT_multiview : enable'],
    ]);
  });

  it('refuses a macro redefined with another body, as glslang does', () => {
    expect(() => tokensOf('#define A 1\n#define A 2')).toThrow(
      "'#define' : Macro redefined; different substitutions: A"
    );
  });

  it('refuses a name that starts with GL_', () => {
    expect(() => tokensOf('#define GL_MINE 1')).toThrow(
      'names beginning with "GL_" can\'t be (un)defined: GL_MINE'
    );
  });

  it('stops at #error with its message and line', () => {
    expect(() => tokensOf('x\n#error no mode')).toThrow(
      expect.objectContaining({ message: expect.stringContaining("'#error' : no mode") })
    );
  });

  it('refuses an #if with no #endif', () => {
    expect(() => tokensOf('#ifdef A\nx')).toThrow('missing #endif');
  });

  it('reads past a division by zero on the side a && skips, as glslang does', () => {
    expect(tokensOf('#if defined(N) && (64 / N) > 4\nyes\n#else\nno\n#endif')).toBe('no');
  });

  it('reads past a division by zero on the side a || skips', () => {
    expect(tokensOf('#if 1 || (1 / 0)\nyes\n#endif')).toBe('yes');
  });
});
