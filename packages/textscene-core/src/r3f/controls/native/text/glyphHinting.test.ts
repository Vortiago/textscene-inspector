import { describe, expect, it } from 'vitest';
import { isNativelyHinted } from './glyphHinting';
import { fontOfFamily } from './sfntFamilyName.testkit';

describe('isNativelyHinted', () => {
  it('runs the native hinter on a tricky font with no programs, which FreeType never auto-hints', () => {
    expect(isNativelyHinted(fontOfFamily('MingLiU'))).toBe(true);
  });

  it('leaves a font with no programs to the auto-hinter', () => {
    expect(isNativelyHinted(fontOfFamily('Open Sans'))).toBe(false);
  });
});
