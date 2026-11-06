import { describe, expect, it } from 'vitest';
import { drawnCharacters, normalisedCharacters } from './canonicalGlyphs';

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

describe('normalisedCharacters', () => {
  const DIAERESIS = '\u0308';
  const DOT_BELOW = '\u0323';
  const ACUTE = '\u0301';

  it('joins a typed base and mark into the composite the font has', () => {
    expect(normalisedCharacters(`A${DIAERESIS}`, facesWith(`A${DIAERESIS}\u00c4`))).toEqual(['\u00c4']);
  });

  it('keeps a typed base and mark apart where the font lacks the composite', () => {
    expect(normalisedCharacters(`x${ACUTE}`, facesWith(`x${ACUTE}`))).toEqual(['x', ACUTE]);
  });

  it('sorts the marks by combining class before it joins them', () => {
    expect(normalisedCharacters(`A${DIAERESIS}${DOT_BELOW}`, facesWith(`A${DIAERESIS}${DOT_BELOW}`))).toEqual(
      ['A', DOT_BELOW, DIAERESIS]
    );
  });

  it('joins a mark past a mark of a lower class, which does not block it', () => {
    const font = facesWith(`A${DIAERESIS}${DOT_BELOW}\u00c4`);
    expect(normalisedCharacters(`A${DOT_BELOW}${DIAERESIS}`, font)).toEqual(['\u00c4', DOT_BELOW]);
  });

  it('joins no mark past a mark of the same class, which blocks it', () => {
    const font = facesWith(`a${DIAERESIS}\u00e4`);
    expect(normalisedCharacters(`a${DIAERESIS}${DIAERESIS}`, font)).toEqual(['\u00e4', DIAERESIS]);
  });

  it('draws nothing where the font cannot draw a character of the cluster', () => {
    expect(normalisedCharacters(`x${ACUTE}`, facesWith('x'))).toBeNull();
  });
});
