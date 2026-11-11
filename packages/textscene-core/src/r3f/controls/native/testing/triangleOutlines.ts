/**
 * Outlines that give every glyph one triangle on its baseline, for a test that draws a face from
 * its outlines and decodes no font.
 */
import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { GlyphContours } from '../text/glyphContours';
import type { SfntOutlines } from '../text/sfntOutlines';

/** A triangle 4 px wide and 6 px tall, its base on the baseline. */
export const TRIANGLE_CONTOURS: GlyphContours = {
  points: [
    { x: 1, y: 0, tag: ContourPointTag.ON },
    { x: 5, y: 0, tag: ContourPointTag.ON },
    { x: 3, y: -6, tag: ContourPointTag.ON },
  ],
  contourEnds: [2],
  isFillRight: true,
};

export const TRIANGLE_OUTLINES: SfntOutlines = {
  glyphIndex: () => 7,
  glyphContours: () => TRIANGLE_CONTOURS,
};
