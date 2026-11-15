import { describe, expect, it } from 'vitest';
import { END, isCharEnd, isCharSpace, isCharWord } from './preprocessorChars.js';

describe('isCharWord', () => {
  it('takes an ASCII letter, a digit and an underscore', () => {
    expect(['a', 'Z', '7', '_'].map(isCharWord)).toEqual([true, true, true, true]);
  });

  it('refuses a missing character and punctuation', () => {
    expect([isCharWord(undefined), isCharWord('/')]).toEqual([false, false]);
  });

  it('refuses a letter outside ASCII', () => {
    expect(isCharWord('é')).toBe(false);
  });
});

describe('isCharSpace', () => {
  it('takes a space and a tab', () => {
    expect([isCharSpace(' '), isCharSpace('\t')]).toEqual([true, true]);
  });

  it('refuses a line feed, which ends a line instead', () => {
    expect(isCharSpace('\n')).toBe(false);
  });

  it('refuses the other whitespace Godot knows', () => {
    expect(isCharSpace(' ')).toBe(false);
  });
});

describe('isCharEnd', () => {
  it('takes a line feed and the closing 0', () => {
    expect([isCharEnd('\n'), isCharEnd(END)]).toEqual([true, true]);
  });

  it('refuses a carriage return', () => {
    expect(isCharEnd('\r')).toBe(false);
  });

  it('refuses a space', () => {
    expect(isCharEnd(' ')).toBe(false);
  });
});
