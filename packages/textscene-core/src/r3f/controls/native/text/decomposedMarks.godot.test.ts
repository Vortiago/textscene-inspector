/**
 * Where a character that Montserrat's mark subsets lack draws its marks, against Godot 4.6.3:
 * `decomposedMarks.godot.json` holds the glyphs that Godot's shaper gives each character, with the
 * offset each mark takes from the pen after the base (`scripts/fonts/decomposed-marks-oracle`). The
 * four fonts differ only in their `GPOS`: whole, none, one with no mark lookup, and one with a script but no lookup at all.
 */
import { describe, expect, it } from 'vitest';
import reference from './decomposedMarks.godot.json';
import { sfntFace } from './sfntFace.testkit';
import { fixtureSfnt } from './sfntOutlines.testkit';
import { glyphsOf } from './textLayout.testkit';

interface ReferenceCharacter {
  readonly font: string;
  readonly char: string;
  readonly sizePx: number;
  readonly glyphs: readonly { advance: number; offset: readonly [number, number] }[];
}

// The JSON module types an offset as number[], not as the pair it holds.
const references = reference as unknown as ReferenceCharacter[];

describe('shapeText — the marks of a decomposed character against Godot', () => {
  it.each(references.map((row) => [`${row.char} at ${row.sizePx} px in ${row.font}`, row] as const))(
    'places %s',
    (_, { font, char, sizePx, glyphs }) => {
      const placed = glyphsOf(char, sfntFace(fixtureSfnt(font)), sizePx);
      // Adding zero turns the layout's -0 into the 0 of the reference.
      expect(
        placed.map(({ advance, xOffset = 0, yOffset = 0 }) => ({
          advance: advance + 0,
          offset: [xOffset + 0, yOffset + 0],
        }))
      ).toEqual(glyphs.map(({ advance, offset }) => ({ advance, offset })));
    }
  );
});
