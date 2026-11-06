/**
 * How a font draws a character it lacks: the marks of its decomposition, each with the offset that
 * the font's `GPOS` mark lookups give it against the base (`canonicalGlyphs.ts`, `markPositioning.ts`).
 */

import { drawnCharacters } from './canonicalGlyphs';
import { markPositioningReader } from './markPositioning';
import { sfntMapsGlyph } from './sfntCmap';
import type { SfntFile } from './sfntTables';

/** A mark drawn over a base, and where its origin sits against the base's origin, in design units with y up. */
export interface DrawnMark {
  readonly char: string;
  readonly xUnits: number;
  readonly yUnits: number;
}

/** A character drawn as a base and the marks over it. */
export interface DecomposedGlyph {
  readonly base: string;
  readonly marks: readonly DrawnMark[];
}

/**
 * How `ch` draws as a base and marks, or null for a character the font draws as one glyph or not
 * at all. A font with no mark lookup keeps its marks at the base's origin.
 */
export type Decomposition = (ch: string) => DecomposedGlyph | null;

export function sfntDecomposition(sfnt: SfntFile): Decomposition | null {
  const mapsGlyph = sfntMapsGlyph(sfnt);
  if (!mapsGlyph) return null;
  // Read at the first decomposed character: most fonts never need their `GPOS`.
  let offsetsOf: ReturnType<typeof markPositioningReader> | undefined;
  const kept = new Map<string, DecomposedGlyph | null>();
  return (ch) => {
    let glyph = kept.get(ch);
    if (glyph === undefined)
      kept.set(ch, (glyph = decompose(ch, mapsGlyph, () => (offsetsOf ??= markPositioningReader(sfnt)))));
    return glyph;
  };
}

function decompose(
  ch: string,
  mapsGlyph: (ch: string) => boolean,
  offsetsOf: () => ReturnType<typeof markPositioningReader>
): DecomposedGlyph | null {
  const drawn = drawnCharacters(ch, mapsGlyph);
  if (!drawn || drawn.length < 2) return null;
  const offsets = offsetsOf()?.(drawn);
  const marks = drawn.slice(1).map((char, i) => ({
    char,
    xUnits: offsets?.[i + 1]?.x ?? 0,
    yUnits: offsets?.[i + 1]?.y ?? 0,
  }));
  return { base: drawn[0]!, marks };
}
