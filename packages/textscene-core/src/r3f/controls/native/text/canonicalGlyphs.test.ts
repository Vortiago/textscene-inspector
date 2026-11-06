import { describe, expect, it } from 'vitest';
import { drawnCharacters } from './canonicalGlyphs';

const facesWith = (characters: string) => (ch: string) => characters.includes(ch);

describe('drawnCharacters', () => {
  it('draws a character the font has as itself', () => {
    expect(drawnCharacters('Ä', facesWith('AÄ̈'))).toEqual(['Ä']);
  });

  it('draws a character the font lacks as its base and mark', () => {
    expect(drawnCharacters('Ä', facesWith('Ä'))).toEqual(['A', '̈']);
  });

  it('keeps the composite the font has, and splits only what it lacks', () => {
    expect(drawnCharacters('Ǟ', facesWith('Ǟ'))).toEqual(['Ä', '̄']);
  });

  it('splits a character through every composite the font lacks', () => {
    expect(drawnCharacters('Ǟ', facesWith('Ǟ'))).toEqual(['A', '̈', '̄']);
  });

  it('draws nothing where a piece of the decomposition is missing', () => {
    expect(drawnCharacters('Ä', facesWith('A'))).toBeNull();
  });

  it('draws nothing for a character with no decomposition that the font lacks', () => {
    expect(drawnCharacters('א', facesWith('A'))).toBeNull();
  });
});
