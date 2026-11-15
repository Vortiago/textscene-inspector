/** Macro expansion, against `expand_macros` (`shader_preprocessor.cpp:1000`). */

import { describe, expect, it } from 'vitest';
import { concatenate, type Define, expandMacros, findMatch } from './macros.js';
import { PreprocessorError } from './preprocessorError.js';

const define = (body: string, names: string[] = []): Define => ({ body, arguments: names, isBuiltIn: false });
const expand = (text: string, defines: Record<string, Define>) =>
  expandMacros(text, new Map(Object.entries(defines)), 0);

describe('expandMacros', () => {
  it('replaces a define with its body between spaces', () => {
    expect(expand('a*K;', { K: define('2.0') })).toBe('a* 2.0 ;');
  });

  it('puts each argument value in the body', () => {
    expect(expand('F(a, b + c)', { F: define('(x - y)', ['x', 'y']) })).toBe(' (a - b + c) ');
  });

  it('splits arguments only at commas outside inner brackets', () => {
    expect(expand('F(max(a, b), c)', { F: define('x', ['x', 'y']) })).toBe(' max(a, b) ');
  });

  it('expands a define inside the body of another', () => {
    expect(expand('A', { A: define('B + B'), B: define('1') })).toBe('  1  +  1  ');
  });

  it('leaves a name that is part of a longer word', () => {
    expect(expand('KK + K_', { K: define('1') })).toBe('KK + K_');
  });

  it("refuses a call with another argument count with Godot's message", () => {
    expect(() => expand('F(a)', { F: define('x', ['x', 'y']) })).toThrow('Invalid macro argument count.');
  });

  it('expands 49 uses of one define on a line, one each pass', () => {
    expect(expand(' K'.repeat(49), { K: define('1') })).not.toContain('K');
  });

  it('refuses 50 uses, as the 51st pass ends the expansion', () => {
    expect(() => expand(' K'.repeat(50), { K: define('1') })).toThrow(PreprocessorError);
  });
});

describe('findMatch', () => {
  it('skips a match inside a word', () => {
    expect(findMatch('aK K', 'K', 0)).toEqual({ index: 3 });
  });
});

describe('concatenate', () => {
  it('joins the words either side of ##, without the spaces', () => {
    expect(concatenate('a ## b')).toBe('ab');
  });

  it('keeps a run of three #', () => {
    expect(concatenate('a ### b')).toBe('a ### b');
  });
});
