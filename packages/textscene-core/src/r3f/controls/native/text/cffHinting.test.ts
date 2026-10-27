/**
 * Every expectation is what Godot's text server returned for the same font bytes
 * (`font_get_glyph_contours` of Godot 4.6.3 at the size in the test). A font of 1000 units per em
 * at 13 px puts 13 thousandths of a pixel on a unit, so a y that lands on a whole pixel or on a
 * fraction of one comes from the hints, not from the scale.
 *
 * The exception is a CFF2 font with a `blend` in its Private DICT: Godot cannot load one without
 * the variation tables, so its expectation is that of the same font written without the `blend`.
 */

import { describe, expect, it } from 'vitest';
import {
  ACCENT_FONT,
  BLUE_FUZZ_FONT,
  BLUE_SCALE_FONT,
  BLUE_SHIFT_FONT,
  CFF2_BLENDED_FONT,
  CFF2_FONT,
  FAMILY_FONT,
  GHOST_FONT,
  IDEOGRAPHIC_FONT,
  INVERTED_STEM_FONT,
  LONE_OTHER_BLUE_FONT,
  MASK_FONT,
  PLACEHOLDER_ZONE_FONT,
  ZONE_FONT,
} from './cffHinting.testkit';
import { drawnAt } from './sfntCff.testkit';

describe('CFF hints against the blue zones', () => {
  it('moves the edges of a stem on the baseline and cap height zones to whole pixels', () => {
    expect(drawnAt(ZONE_FONT, 1, 9)).toEqual(['0.890625,0 4.5,0 4.5,-7 0.890625,-7']);
  });

  it('leaves y where the scale puts it for a glyph without stems', () => {
    expect(drawnAt(ZONE_FONT, 8, 13)).toEqual(['1.296875,0 6.5,0 6.5,-9.09375 1.296875,-9.09375']);
  });

  it('flattens the overshoot of a zone below the BlueScale size', () => {
    expect(drawnAt(ZONE_FONT, 2, 39)).toEqual(['3.890625,0 19.5,0 19.5,-27 3.890625,-27']);
  });

  it('draws the overshoot of a zone from the BlueScale size', () => {
    expect(drawnAt(ZONE_FONT, 2, 41)).toEqual(['4.09375,1 20.5,1 20.5,-30 4.09375,-30']);
  });

  it('moves the curves of an oval with the edges of its stem', () => {
    expect(drawnAt(ZONE_FONT, 7, 13)).toEqual([
      '3.890625,0 ~5.03125,0 ~6.5,-2.796875 6.5,-5 ~6.5,-7.203125 ~5.03125,-10 3.890625,-10 ~2.75,-10 ~1.296875,-7.203125 1.296875,-5 ~1.296875,-2.796875 ~2.75,0',
    ]);
  });

  it('places a descender stem by an OtherBlues zone', () => {
    expect(drawnAt(ZONE_FONT, 3, 13)).toEqual(['1.296875,3 6.5,3 6.5,-4 1.296875,-4']);
  });

  it('rounds one edge of a stem in no zone to a whole pixel and keeps its width', () => {
    expect(drawnAt(ZONE_FONT, 4, 13)).toEqual(['1.296875,-4 6.5,-4 6.5,-4.515625 1.296875,-4.515625']);
  });

  it('swaps the edges of a stem whose width is negative', () => {
    expect(drawnAt(INVERTED_STEM_FONT, 1, 41)).toEqual([
      '4.09375,-12.359375 20.5,-12.359375 20.5,-14 4.09375,-14',
    ]);
  });

  it('reads an OtherBlues array that ends on a lone value', () => {
    expect(drawnAt(LONE_OTHER_BLUE_FONT, 1, 13)).toEqual(['1.296875,0 6.5,0 6.5,-0.25 1.296875,-0.25']);
  });

  it('hints the edges of two stems closer together than a pixel', () => {
    expect(drawnAt(ZONE_FONT, 5, 9)).toEqual(['0.890625,-0.71875 4.5,-0.71875 4.5,-2 0.890625,-2']);
  });

  it('hints a stem in the 500 zone and the contour after it', () => {
    expect(drawnAt(ZONE_FONT, 6, 13)).toEqual([
      '1.296875,-6.859375 6.5,-6.859375 6.5,-7 1.296875,-7',
      '9.09375,-7 11.6875,-7 11.6875,-8.296875 9.09375,-8.296875',
    ]);
  });

  it('flattens the overshoot of a zone at a size below the BlueScale of the Private DICT', () => {
    expect(drawnAt(BLUE_SCALE_FONT, 1, 41)).toEqual([
      '12.296875,0 ~15.90625,0 ~20.5,-8.140625 20.5,-14.5 ~20.5,-20.84375 ~15.90625,-29 12.296875,-29 ~8.6875,-29 ~4.09375,-20.84375 4.09375,-14.5 ~4.09375,-8.140625 ~8.6875,0',
    ]);
  });

  it('draws no pixel of overshoot for an overshoot smaller than the BlueShift of the Private DICT', () => {
    expect(drawnAt(BLUE_SHIFT_FONT, 1, 41)).toEqual(['4.09375,0 20.5,0 20.5,-29 4.09375,-29']);
  });

  it('places an edge 2 units outside a zone by the zone when the BlueFuzz of the Private DICT is 4', () => {
    expect(drawnAt(BLUE_FUZZ_FONT, 1, 13)).toEqual(['1.296875,0 6.5,0 6.5,-10 1.296875,-10']);
  });

  it('places the edges of a stem on the baseline and cap height by the FamilyBlues', () => {
    expect(drawnAt(FAMILY_FONT, 1, 9)).toEqual(['0.890625,0 4.5,0 4.5,-6 0.890625,-6']);
  });

  it('places an overshoot edge by the FamilyBlues', () => {
    expect(drawnAt(FAMILY_FONT, 2, 13)).toEqual(['1.296875,0 6.5,0 6.5,-8.859375 1.296875,-8.859375']);
  });
});

describe('CFF hint masks', () => {
  const MASKED_BOX_AND_BAR = [
    '1.296875,0 3.890625,0 3.890625,-10 1.296875,-10',
    '6.5,-13.578125 11.6875,-13.578125 11.6875,-14.09375 6.5,-14.09375',
  ];

  it('hints each contour with the stems its hintmask names', () => {
    expect(drawnAt(MASK_FONT, 1, 13)).toEqual(MASKED_BOX_AND_BAR);
  });

  it('hints the same after a cntrmask that names the stems of the hintmask', () => {
    expect(drawnAt(MASK_FONT, 2, 13)).toEqual(MASKED_BOX_AND_BAR);
  });

  it('counts the stems a hintmask declares with its operands', () => {
    expect(drawnAt(MASK_FONT, 3, 13)).toEqual(['1.296875,0 3.890625,0 3.890625,-10 1.296875,-10']);
  });

  it('switches the stems in the middle of a contour', () => {
    expect(drawnAt(MASK_FONT, 4, 13)).toEqual([
      '1.296875,0 6.5,0 6.5,-10 1.296875,-9.671875 1.296875,-4.46875',
    ]);
  });
});

describe('CFF ghost hints', () => {
  it('snaps the edge of a ghost hint with a width of -20 to the zone', () => {
    expect(drawnAt(GHOST_FONT, 1, 13)).toEqual(['1.296875,-9.34375 6.5,-9.34375 6.5,-10 1.296875,-10']);
  });

  it('places the edges of a stem by a ghost hint with a width of -21', () => {
    expect(drawnAt(GHOST_FONT, 2, 13)).toEqual([
      '1.296875,-0.265625 6.5,-0.265625 6.5,-0.921875 1.296875,-0.921875',
    ]);
  });

  it('places a glyph that has a ghost hint of each width', () => {
    expect(drawnAt(GHOST_FONT, 3, 13)).toEqual(['1.296875,0.40625 6.5,0.40625 6.5,-10 1.296875,-10']);
  });
});

describe('CFF ideographic fonts', () => {
  it('places stems inside the em box of a language group 1 font that has no zones', () => {
    expect(drawnAt(IDEOGRAPHIC_FONT, 1, 13)).toEqual([
      '1.296875,0 11.6875,0 11.6875,-10.9375 1.296875,-10.9375',
    ]);
  });

  it('places stems on the edges of the em box of a language group 1 font that has no zones', () => {
    expect(drawnAt(IDEOGRAPHIC_FONT, 3, 13)).toEqual([
      '1.296875,2.390625 11.6875,2.390625 11.6875,-11.875 1.296875,-11.875',
    ]);
  });

  it('places stems as without zones when the zones of a language group 1 font are the placeholder pair', () => {
    expect(drawnAt(PLACEHOLDER_ZONE_FONT, 1, 13)).toEqual([
      '1.296875,2.390625 11.6875,2.390625 11.6875,-11.875 1.296875,-11.875',
    ]);
  });
});

describe('CFF accented letters', () => {
  it('hints the base letter and the accent of an accented letter, each with its own stems', () => {
    expect(drawnAt(ACCENT_FONT, 3, 13)).toEqual([
      '1.9375,-10 3.25,-10 3.25,-10.765625 1.9375,-10.765625',
      '0,0 2.59375,0 2.59375,-10 0,-10',
    ]);
  });
});

describe('CFF2 hints', () => {
  it('hints a glyph of a CFF2 font', () => {
    expect(drawnAt(CFF2_FONT, 1, 13)).toEqual(['1.296875,0 6.5,0 6.5,-9.859375 1.296875,-9.859375']);
    expect(drawnAt(CFF2_FONT, 2, 13)).toEqual(['1.296875,0 6.5,0 6.5,-10 1.296875,-10']);
  });

  it('reads the zones of a Private DICT that blends them', () => {
    expect(drawnAt(CFF2_BLENDED_FONT, 1, 13)).toEqual(drawnAt(CFF2_FONT, 1, 13));
    expect(drawnAt(CFF2_BLENDED_FONT, 2, 13)).toEqual(drawnAt(CFF2_FONT, 2, 13));
  });
});
