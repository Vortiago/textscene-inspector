import { describe, expect, it } from 'vitest';
import { escapeRegExp, TRIVIA } from './regExp';

describe('escapeRegExp', () => {
  it('matches a literal holding every RegExp metacharacter, and nothing else', () => {
    const literal = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o';
    const re = new RegExp(`^${escapeRegExp(literal)}$`);
    expect(re.test(literal)).toBe(true);
    expect(re.test('aXb*c+d?e^f$g{h}i(j)k|l[m]n\\o')).toBe(false);
  });

  it('leaves a literal with no metacharacter unchanged', () => {
    expect(escapeRegExp('arms_key-1')).toBe('arms_key-1');
  });

  it('escapes the empty string to itself', () => {
    expect(escapeRegExp('')).toBe('');
  });
});

describe('TRIVIA', () => {
  const tokens = new RegExp(`^a${TRIVIA}b$`);

  it('matches whitespace, a block comment and a line comment between two tokens', () => {
    expect(
      ['ab', 'a \n b', 'a/* c */b', 'a // c\nb', 'a /* c */ // d\n b'].map((s) => tokens.test(s))
    ).toEqual([true, true, true, true, true]);
  });

  it('refuses other text between the tokens (error case)', () => {
    expect(['a x b', 'a / b', 'a // c b'].map((s) => tokens.test(s))).toEqual([false, false, false]);
  });
});
