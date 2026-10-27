/**
 * The test fonts of the CFF y hinting: boxes and ovals of 1000 units per em with hstems and blue
 * zones. Glyph `i` of a font maps from the character `0x40 + i`.
 */

import { charstring as cs, type CharstringToken, type TestBlues, type TestCffFont } from './sfntCff.testkit';

type Tokens = readonly CharstringToken[];

const NOTDEF = cs('endchar');

/** A rectangle from `(left, bottom)` to `(right, top)`, drawn clockwise from its lower left. */
const box = (left: number, bottom: number, right: number, top: number): Tokens => [
  left,
  bottom,
  'rmoveto',
  right - left,
  'hlineto',
  top - bottom,
  'vlineto',
  left - right,
  'hlineto',
];

/** An ellipse of four curves with its extremes on the four sides of the rectangle. */
function oval(left: number, bottom: number, right: number, top: number): Tokens {
  const halfWidth = Math.round((right - left) / 2);
  const halfHeight = Math.round((top - bottom) / 2);
  const handleX = Math.round((right - left) * 0.28);
  const handleY = Math.round((top - bottom) * 0.28);
  return [
    left + halfWidth,
    bottom,
    'rmoveto',
    halfWidth - handleX,
    0,
    handleX,
    handleY,
    0,
    halfHeight - handleY,
    'rrcurveto',
    0,
    halfHeight - handleY,
    -handleX,
    handleY,
    -(halfWidth - handleX),
    0,
    'rrcurveto',
    -(halfWidth - handleX),
    0,
    -handleX,
    -handleY,
    0,
    -(halfHeight - handleY),
    'rrcurveto',
    0,
    -(halfHeight - handleY),
    handleX,
    -handleY,
    halfWidth - handleX,
    0,
    'rrcurveto',
  ];
}

/** `hintmask` or `cntrmask` with the stems it names as the set bits of one byte. */
const hintmask = (stemBits: number): Tokens => [{ raw: [19, stemBits] }];
const cntrmask = (stemBits: number): Tokens => [{ raw: [20, stemBits] }];

const glyph = (...parts: Tokens[]) => cs(...parts.flat(), 'endchar');

function fontOf(glyphs: readonly (readonly number[])[], extra: Partial<TestCffFont> = {}): TestCffFont {
  return {
    unitsPerEm: 1000,
    glyphs: [NOTDEF, ...glyphs],
    cmap: new Map(glyphs.map((_, i) => [0x41 + i, i + 1])),
    ...extra,
  };
}

/** A baseline zone with an overshoot below it, an ascender zone, a 500 zone and a descender zone. */
const ZONES: TestBlues = { blueValues: [-10, 0, 700, 710, 500, 510], otherBlues: [-210, -200] };

/** Stems on the zone edges, over them, and in no zone, in boxes, ovals and one pair of close stems. */
export const ZONE_FONT = fontOf(
  [
    glyph([0, 20, 660, 20, 'hstem'], box(100, 0, 500, 700)),
    glyph([-10, 20, 680, 20, 'hstem'], box(100, -10, 500, 710)),
    glyph([-200, 20, 480, 20, 'hstem'], box(100, -200, 500, 300)),
    glyph([300, 40, 'hstem'], box(100, 300, 500, 340)),
    glyph([100, 30, 20, 30, 'hstem'], box(100, 100, 500, 180)),
    glyph([490, 20, 'hstem'], box(100, 500, 500, 510), box(600, 0, 800, 100)),
    glyph([-10, 20, 680, 20, 'hstem'], oval(100, -10, 500, 710)),
    glyph(box(100, 0, 500, 700)),
  ],
  { blues: ZONES }
);

/** A BlueScale that stays above every size the tests draw at, so the overshoot of a zone is flattened. */
export const BLUE_SCALE_FONT = fontOf([glyph([-10, 20, 680, 20, 'hstem'], oval(100, -10, 500, 710))], {
  blues: { blueValues: [-10, 0, 700, 710], blueScale: 0.1 },
});

/** A BlueShift of 12 units, beyond the 10 units of overshoot of the zones. */
export const BLUE_SHIFT_FONT = fontOf([glyph([-10, 20, 680, 20, 'hstem'], box(100, -10, 500, 710))], {
  blues: { blueValues: [-10, 0, 700, 710], blueShift: 12 },
});

/** A BlueFuzz of 4 units, which reaches edges 2 units outside the zones that the default of 1 does not. */
export const BLUE_FUZZ_FONT = fontOf([glyph([-12, 20, 684, 20, 'hstem'], box(100, -12, 500, 712))], {
  blues: { blueValues: [-10, 0, 700, 710], blueFuzz: 4 },
});

/** Family zones that sit within and beyond a device pixel of the zones of the font. */
export const FAMILY_FONT = fontOf(
  [
    glyph([0, 20, 680, 20, 'hstem'], box(100, 0, 500, 700)),
    glyph([-10, 20, 680, 20, 'hstem'], box(100, -10, 500, 700)),
    glyph([-200, 20, 480, 20, 'hstem'], box(100, -200, 500, 300)),
  ],
  {
    blues: {
      blueValues: [-10, 0, 700, 710],
      otherBlues: [-210, -200],
      familyBlues: [-14, 3, 690, 704],
      familyOtherBlues: [-208, -198],
    },
  }
);

/** Hint substitution: two stem groups, a counter mask, a mask that names a vstem, and a switch inside a contour. */
export const MASK_FONT = fontOf(
  [
    glyph(
      [0, 20, 280, 40, 340, 20, 'hstemhm'],
      hintmask(0xa0),
      box(100, 0, 300, 700),
      hintmask(0x40),
      box(400, 300, 800, 340)
    ),
    glyph(
      [0, 20, 280, 40, 340, 20, 'hstemhm'],
      cntrmask(0xa0),
      hintmask(0xa0),
      box(100, 0, 300, 700),
      hintmask(0x40),
      box(400, 300, 800, 340)
    ),
    glyph([0, 20, 280, 40, 340, 20, 'hstemhm', 100, 50], hintmask(0xe0), box(100, 0, 300, 700)),
    glyph(
      [0, 20, 280, 40, 340, 20, 'hstemhm'],
      hintmask(0xa0),
      [100, 0, 'rmoveto', 400, 'hlineto', 700, 'vlineto'],
      hintmask(0x40),
      [-400, 'hlineto', -400, 'vlineto']
    ),
  ],
  { blues: ZONES }
);

/** Ghost hints, whose width is -20 for a top edge and -21 for a bottom edge. */
export const GHOST_FONT = fontOf(
  [
    glyph([700, -20, 'hstem'], box(100, 650, 500, 700)),
    glyph([0, -21, 'hstem'], box(100, 0, 500, 50)),
    glyph([700, -20, -700, -21, 'hstem'], box(100, 0, 500, 700)),
  ],
  { blues: ZONES }
);

/** An ideographic font, which has no zones of its own and gets the edges of its em box instead. */
export const IDEOGRAPHIC_FONT = fontOf(
  [
    glyph([50, 40, 800, 40, 'hstem'], box(100, 50, 900, 840)),
    glyph(box(100, -120, 900, 880)),
    glyph([-120, 30, 940, 30, 'hstem'], box(100, -120, 900, 910)),
  ],
  { blues: { languageGroup: 1 } }
);

/** An ideographic font whose zones are the placeholder pair that carries no information. */
export const PLACEHOLDER_ZONE_FONT = fontOf(
  [
    glyph([-120, 30, 940, 30, 'hstem'], box(100, -120, 900, 910)),
    glyph([50, 40, 800, 40, 'hstem'], box(100, 50, 900, 840)),
  ],
  { blues: { languageGroup: 1, blueValues: [-250, -250, 1100, 1100] } }
);

/** A stem whose width is negative but not that of a ghost hint, so its edges are in the wrong order. */
export const INVERTED_STEM_FONT = fontOf([glyph([340, -40, 'hstem'], box(100, 300, 500, 340))], {
  blues: ZONES,
});

/** An OtherBlues array that ends on a lone value, which FreeType reads as the bottom of a zone with a top at zero. */
export const LONE_OTHER_BLUE_FONT = fontOf([glyph([-40, 20, 'hstem'], box(100, -40, 500, -20))], {
  blues: { blueValues: [-10, 0, 700, 710], otherBlues: [-210, -200, -50] },
});

/** A base letter, an accent, and an accented letter built from both with `endchar`. */
export const ACCENT_FONT = fontOf(
  [
    glyph([0, 20, 660, 20, 'hstem'], box(0, 0, 200, 700)),
    glyph([0, 60, 'hstem'], box(0, 0, 100, 60)),
    cs(150, 760, 65, 194, 'endchar'),
  ],
  { blues: ZONES, charset: [34, 125, 35] }
);

/** CFF2, where a charstring has no `endchar`: the zones written plainly, and each written as a `blend` of zero deltas. */
const CFF2_BLUES: TestBlues = { blueValues: [-10, 0, 700, 710], otherBlues: [-210, -200] };
const CFF2_GLYPHS = [
  cs(-10, 20, 680, 20, 'hstem', ...box(100, -10, 500, 700)),
  cs(0, 20, 660, 20, 'hstem', ...box(100, 0, 500, 700)),
];
const cff2Font = (extra: Partial<TestCffFont>) => ({
  ...fontOf(CFF2_GLYPHS, { version: 2, blues: CFF2_BLUES, ...extra }),
  glyphs: [cs(), ...CFF2_GLYPHS],
});

export const CFF2_FONT = cff2Font({});
export const CFF2_BLENDED_FONT = cff2Font({ variation: { regionCounts: [1], vsindex: 0 } });
