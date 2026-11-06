import { describe, expect, it } from 'vitest';
import { scriptTagsOf } from './afScripts';

describe('the script tags of a character', () => {
  it.each([
    ['a Latin letter', 'a', ['latn']],
    ['an Arabic letter', 'ل', ['arab']],
    ['a Hebrew letter', 'א', ['hebr']],
  ])('are those of the script of %s', (_, character, tags) => {
    expect(scriptTagsOf(character.codePointAt(0)!)).toEqual(tags);
  });

  it("are none for a character in no script's ranges, so the default script shapes it", () => {
    expect(scriptTagsOf(0x2603)).toEqual([]);
  });
});
