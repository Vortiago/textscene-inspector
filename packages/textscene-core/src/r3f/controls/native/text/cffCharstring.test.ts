/**
 * Every expectation is what Godot's text server returned for the same font bytes
 * (`font_get_glyph_contours` of Godot 4.6.3 at 100 px). A font of 1000 units per em at 100 px puts
 * a tenth of a pixel on a unit. The fonts here have no blue zones: `cffHinting.test.ts` covers those.
 */

import { describe, expect, it } from 'vitest';
import { charstring as cs, drawnAt, type CharstringToken, type TestCffFont } from './sfntCff.testkit';

const FONT_SIZE_PX = 100;
const NOTDEF = cs('endchar');

/** What glyph `glyphIndex` of `font` draws at 100 px, or null when it draws nothing. */
const drawn = (font: TestCffFont, glyphIndex: number) => drawnAt(font, glyphIndex, FONT_SIZE_PX);

function fontOf(glyphs: readonly (readonly number[])[], extra: Partial<TestCffFont> = {}): TestCffFont {
  return {
    unitsPerEm: 1000,
    glyphs: [NOTDEF, ...glyphs],
    cmap: new Map(glyphs.map((_, i) => [0x41 + i, i + 1])),
    ...extra,
  };
}

/** What a font whose only glyph is `tokens` draws. */
function draw(
  tokens: readonly CharstringToken[],
  extra: Partial<TestCffFont> = {}
): Promise<string[] | null> {
  return drawn(fontOf([cs(...tokens)], extra), 1);
}

const MOVE = [100, 100, 'rmoveto'] as const;

describe('CFF lines and moves', () => {
  it('alternates hlineto between the axes from x', async () => {
    expect(await draw([...MOVE, 50, 'hlineto', 50, 'vlineto', 50, 'hlineto', 'endchar'])).toEqual([
      '10,-10 15,-10 15,-15 20,-15',
    ]);
  });

  it('alternates vlineto between the axes from y', async () => {
    expect(await draw([...MOVE, 50, 'vlineto', 50, 'hlineto', 50, 'vlineto', 'endchar'])).toEqual([
      '10,-10 10,-15 15,-15 15,-20',
    ]);
  });

  it('draws rlineto as pairs of deltas', async () => {
    expect(await draw([10, 20, 'rmoveto', 100, 0, 'rlineto', 0, 100, 'rlineto', 'endchar'])).toEqual([
      '1,-2 11,-2 11,-12',
    ]);
  });

  it('closes a contour with a line back to its start', async () => {
    expect(await draw([...MOVE, 50, 'hlineto', 50, 'vlineto', -50, 'hlineto', 'endchar'])).toEqual([
      '10,-10 15,-10 15,-15 10,-15',
    ]);
  });

  it('drops the last point of a contour that ends on its first', async () => {
    expect(
      await draw([...MOVE, 50, 'hlineto', 50, 'vlineto', -50, 'hlineto', -50, 'vlineto', 'endchar'])
    ).toEqual(['10,-10 15,-10 15,-15 10,-15']);
  });

  it('skips a line of zero length', async () => {
    expect(
      await draw([...MOVE, 0, 'hlineto', 50, 'vlineto', 0, 0, 'rlineto', -50, 'hlineto', 'endchar'])
    ).toEqual(['10,-10 10,-15 5,-15']);
  });

  it('starts a contour at each move, relative to where the last one ended', async () => {
    expect(
      await draw([
        ...MOVE,
        200,
        100,
        'rmoveto',
        50,
        'hlineto',
        50,
        'vlineto',
        20,
        30,
        'rmoveto',
        40,
        'hlineto',
        40,
        'vlineto',
        -40,
        'hlineto',
        'endchar',
      ])
    ).toEqual(['30,-20 35,-20 35,-25', '37,-28 41,-28 41,-32 37,-32']);
  });

  it('starts the next move from the last point drawn, not from the contour start', async () => {
    expect(
      await draw([
        ...MOVE,
        100,
        'hlineto',
        100,
        'vlineto',
        5,
        'hmoveto',
        50,
        'hlineto',
        50,
        'vlineto',
        'endchar',
      ])
    ).toEqual(['10,-10 20,-10 20,-20', '20.5,-20 25.5,-20 25.5,-25']);
  });

  it('moves along one axis with hmoveto and vmoveto', async () => {
    expect(await draw([10, 0, 'hmoveto', 100, 'hlineto', 100, 'vlineto', 'endchar'])).toEqual([
      '0,0 10,0 10,-10',
    ]);
    expect(await draw([10, 'vmoveto', 100, 'hlineto', 100, 'vlineto', 'endchar'])).toEqual([
      '0,-1 10,-1 10,-11',
    ]);
  });

  it('ignores a width operand before the first move', async () => {
    expect(await draw([10, 20, 30, 'hmoveto', 100, 'hlineto', 100, 'vlineto', 'endchar'])).toEqual([
      '3,0 13,0 13,-10',
    ]);
  });

  it('draws a path that has no move from the origin', async () => {
    expect(await draw([100, 'hlineto', 100, 'vlineto', 100, 'hlineto', 'endchar'])).toEqual([
      '0,0 10,0 10,-10 20,-10',
    ]);
  });

  it('keeps the contours drawn before a trailing move', async () => {
    expect(await draw([...MOVE, 100, 'hlineto', 100, 'vlineto', 200, 'hmoveto', 'endchar'])).toEqual([
      '10,-10 20,-10 20,-20',
    ]);
  });

  it('draws nothing for a move alone', async () => {
    expect(await draw([...MOVE, 'endchar'])).toBeNull();
  });
});

describe('CFF curves', () => {
  it('draws rrcurveto as a cubic arc for each six deltas', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 20, 30, 40, 50, 60, 'rrcurveto', 'endchar'])).toEqual([
      '0,0 ~1,-2 ~4,-6 9,-12',
    ]);
  });

  it('drops the deltas that rrcurveto cannot make a curve of', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 60, 10, 30, 'rrcurveto', 'endchar'])).toEqual([
      '0,0 ~1,-4 ~3,-9 9,-10',
    ]);
  });

  it('ends rcurveline with a line', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 60, 10, 30, 30, 'rcurveline', 'endchar'])).toEqual([
      '0,0 ~1,-4 ~3,-9 9,-10 12,-13',
    ]);
  });

  it('starts rlinecurve with lines', async () => {
    expect(
      await draw([0, 0, 'rmoveto', 30, 30, 5, 5, 10, 40, 20, 50, 60, 10, 'rlinecurve', 'endchar'])
    ).toEqual(['0,0 3,-3 3.5,-3.5 ~4.5,-7.5 ~6.5,-12.5 12.5,-13.5']);
  });

  it('starts hhcurveto and vvcurveto curves along their axis', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 'hhcurveto', 'endchar'])).toEqual([
      '0,0 ~1,0 ~5,-2 10,-2',
    ]);
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 'vvcurveto', 'endchar'])).toEqual([
      '0,0 ~0,-1 ~4,-3 4,-8',
    ]);
  });

  it('gives the first curve of hhcurveto a leading dy when an operand is spare', async () => {
    expect(await draw([0, 0, 'rmoveto', 5, 10, 40, 20, 50, 'hhcurveto', 'endchar'])).toEqual([
      '0,0 ~1,-0.5 ~5,-2.5 10,-2.5',
    ]);
  });

  it('gives the first curve of vvcurveto a leading dx when an operand is spare', async () => {
    expect(await draw([0, 0, 'rmoveto', 5, 10, 40, 20, 50, 'vvcurveto', 'endchar'])).toEqual([
      '0,0 ~0.5,-1 ~4.5,-3 4.5,-8',
    ]);
  });

  it('skips two operands of hhcurveto and vvcurveto when a count is of the form 4n+2', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 60, 70, 'hhcurveto', 'endchar'])).toEqual([
      '0,0 ~2,0 ~7,-6 14,-6',
    ]);
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 60, 70, 'vvcurveto', 'endchar'])).toEqual([
      '0,0 ~0,-2 ~5,-8 5,-15',
    ]);
  });

  it('turns hvcurveto and vhcurveto between a horizontal and a vertical tangent', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 11, 12, 13, 14, 'hvcurveto', 'endchar'])).toEqual([
      '0,0 ~1,0 ~5,-2 5,-7 ~5,-8.09375 ~6.1875,-9.390625 7.59375,-9.390625',
    ]);
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 11, 12, 13, 14, 'vhcurveto', 'endchar'])).toEqual([
      '0,0 ~0,-1 ~4,-3 9,-3 ~10.09375,-3 ~11.296875,-4.296875 11.296875,-5.6875',
    ]);
  });

  it('ends the last curve of hvcurveto and vhcurveto off its axis with a spare operand', async () => {
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 7, 'hvcurveto', 'endchar'])).toEqual([
      '0,0 ~1,0 ~5,-2 5.6875,-7',
    ]);
    expect(await draw([0, 0, 'rmoveto', 10, 40, 20, 50, 11, 12, 13, 14, 9, 'vhcurveto', 'endchar'])).toEqual([
      '0,0 ~0,-1 ~4,-3 9,-3 ~10.09375,-3 ~11.296875,-4.296875 12.1875,-5.6875',
    ]);
  });
});

describe('CFF flex', () => {
  it.each([
    ['hflex', [10, 20, 30, 40, 50, 60, 70, 'hflex'], ['0,0 ~1,0 ~3,-3 7,-3 ~12,-3 ~18,0 25,0']],
    [
      'flex',
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 50, 'flex'],
      ['0,0 ~1,-2 ~4,-6 9,-12 ~16,-20 ~25,-30 36,-42'],
    ],
    ['hflex1', [10, 20, 30, 40, 50, 60, 70, 80, 90, 'hflex1'], ['0,0 ~1,-2 ~4,-6 9,-6 ~15,-6 ~22,-14 31,0']],
    [
      'flex1 ending along x',
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 'flex1'],
      ['0,0 ~1,-2 ~4,-6 9,-12 ~16,-20 ~25,-30 0,-41'],
    ],
    [
      'flex1 ending along y',
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 5, 110, 'flex1'],
      ['0,0 ~1,-2 ~4,-6 9,-12 ~16,-20 ~25,-20.5 36,0'],
    ],
  ] as const)('draws %s as two curves', async (_, operands, expected) => {
    expect(await draw([0, 0, 'rmoveto', ...operands, 'endchar'])).toEqual(expected);
  });
});

describe('CFF subroutines', () => {
  const localSubrs = [
    [
      cs(50, 'hlineto', 50, 'vlineto', 50, 'hlineto', 'return'),
      cs(50, 'vlineto', 'endchar'),
      cs(-105, 'callgsubr', 'return'),
      cs('return'),
    ],
  ];
  const globalSubrs = [
    cs(60, 'hlineto', 60, 'vlineto', -60, 'hlineto', 'return'),
    cs(30, 'vlineto', 'return'),
    cs(10, 'hlineto', 'return'),
  ];
  const withSubrs = (...tokens: readonly CharstringToken[]) =>
    draw([...MOVE, ...tokens, 'endchar'], { localSubrs, globalSubrs });

  it('calls a local subroutine by its number plus a bias of 107', async () => {
    expect(await withSubrs(-107, 'callsubr')).toEqual(['10,-10 15,-10 15,-15 20,-15']);
    expect(await withSubrs(-106, 'callsubr')).toEqual(['10,-10 10,-15']);
  });

  it('calls a global subroutine the same way', async () => {
    expect(await withSubrs(-107, 'callgsubr')).toEqual(['10,-10 16,-10 16,-16 10,-16']);
    expect(await withSubrs(-106, 'callgsubr', 50, 'hlineto')).toEqual(['10,-10 10,-13 15,-13']);
  });

  it('keeps the stack and the position across a call and its return', async () => {
    expect(
      await draw([...MOVE, 50, 'hlineto', -104, 'callsubr', 50, 'vlineto', 'endchar'], {
        localSubrs,
        globalSubrs,
      })
    ).toEqual(['10,-10 15,-10 15,-15']);
  });

  it('calls a global subroutine from a local one', async () => {
    expect(await withSubrs(-105, 'callsubr')).toEqual(['10,-10 11,-10']);
  });

  it('ends the glyph at an endchar inside a subroutine', async () => {
    expect(await withSubrs(-106, 'callsubr', 50, 'hlineto')).toEqual(['10,-10 10,-15']);
  });

  it('allows 16 nested calls and refuses a 17th', async () => {
    // Local subroutine i calls i + 1, and the last one draws.
    const chain = Array.from({ length: 21 }, (_, i) =>
      i < 20
        ? cs(i + 1 - 107, 'callsubr', 'return')
        : cs(50, 'hlineto', 50, 'vlineto', 50, 'hlineto', 'return')
    );
    const call = (depth: number) =>
      draw([...MOVE, 20 - depth - 107, 'callsubr', 'endchar'], { localSubrs: [chain] });
    expect(await call(15)).toEqual(['10,-10 15,-10 15,-15 20,-15']);
    expect(await call(16)).toBeNull();
  });

  it.each([
    ['a subroutine that is not in the font', [...MOVE, 5, 'callsubr', 'endchar']],
    ['a subroutine called with a fixed-point number', [...MOVE, 3, 3, 'add', 'callsubr', 'endchar']],
    ['a subroutine called with no number', [...MOVE, 'callsubr', 'endchar']],
    ['a return from the top level', [...MOVE, 50, 'hlineto', 50, 'vlineto', 'return']],
  ] as const)('refuses %s', async (_, tokens) => {
    expect(await draw(tokens, { localSubrs, globalSubrs })).toBeNull();
  });
});

describe('CFF hints', () => {
  const SQUARE = [100, 200, 'rmoveto', 50, 'hlineto', 50, 'vlineto', 'endchar'] as const;
  /** The operands of `count` stems. */
  const stems = (count: number) => Array.from({ length: count * 2 }, (_, i) => i + 1);
  /** Stem operators that declare `count` stems together, 24 at most to each as the operand stack allows. */
  const stemOperators = (count: number): CharstringToken[] =>
    Array.from({ length: Math.ceil(count / 24) }, (_, i) => [
      ...stems(Math.min(24, count - i * 24)),
      'hstemhm' as const,
    ]).flat();

  it('skips one mask byte for each eight stems', async () => {
    expect(
      await draw([10, 20, 'hstemhm', 10, 20, 'vstemhm', 'hintmask', { raw: [0xc0] }, ...SQUARE])
    ).toEqual(['10,-20 15,-20 15,-25']);
    // Nine stems take two bytes.
    expect(
      await draw([...stems(8), 'hstemhm', 10, 20, 'vstemhm', 'hintmask', { raw: [0xff, 0x80] }, ...SQUARE])
    ).toEqual(['10,-20 15,-20 15,-25']);
  });

  it('counts the stems that operands of a hintmask declare', async () => {
    expect(await draw([10, 20, 'hstemhm', 10, 20, 'hintmask', { raw: [0x80] }, ...SQUARE])).toEqual([
      '10,-20 15,-20 15,-25',
    ]);
  });

  it('skips the mask bytes of a cntrmask', async () => {
    expect(await draw([10, 20, 'hstemhm', 'cntrmask', { raw: [0x80] }, ...SQUARE])).toEqual([
      '10,-20 15,-20 15,-25',
    ]);
  });

  it('ignores an hstem after the hint mask', async () => {
    expect(
      await draw([
        10,
        20,
        'hstemhm',
        10,
        20,
        'vstemhm',
        'hintmask',
        { raw: [0xc0] },
        10,
        20,
        'hstem',
        ...SQUARE,
      ])
    ).toEqual(['10,-20 15,-20 15,-25']);
  });

  it('runs the mask bytes as operators after an ignored hintmask', async () => {
    // A hintmask with more than one operand after the mask is ignored, and its mask bytes with it.
    expect(
      await draw([
        10,
        20,
        'hstemhm',
        10,
        20,
        'vstemhm',
        'hintmask',
        { raw: [0xc0] },
        10,
        20,
        'hintmask',
        { raw: [0x21, 0x22] },
        ...SQUARE,
      ])
    ).toEqual(['10,-20 15,-20 15,-25']);
  });

  it('draws a width as an odd operand before the stems', async () => {
    expect(await draw([50, 10, 20, 'hstem', ...SQUARE])).toEqual(['10,-20 15,-20 15,-25']);
  });

  it('accepts 96 stems and refuses 97', async () => {
    expect(
      await draw([...stemOperators(96), 'hintmask', { raw: Array<number>(12).fill(0) }, ...SQUARE])
    ).toEqual(['10,-20 15,-20 15,-25']);
    expect(
      await draw([...stemOperators(97), 'hintmask', { raw: Array<number>(13).fill(0) }, ...SQUARE])
    ).toBeNull();
  });
});

describe('CFF arithmetic', () => {
  /** A square whose side the operands on the stack make: `tokens` leaves one number for hlineto. */
  const side = (...tokens: readonly CharstringToken[]) =>
    draw([0, 0, 'rmoveto', ...tokens, 'hlineto', 100, 'vlineto', 'endchar']);

  it.each([
    ['add', [100, 50, 'add'], ['0,0 15,0 15,-10']],
    ['sub', [100, 30, 'sub'], ['0,0 7,0 7,-10']],
    ['mul', [100, 3, 'mul'], ['0,0 30,0 30,-10']],
    ['div', [100, 3, 'div'], ['0,0 3.328125,0 3.328125,-10']],
    ['neg', [100, 'neg'], ['0,0 -10.015625,0 -10.015625,-10']],
    ['abs', [-100, 'abs'], ['0,0 10,0 10,-10']],
    ['sqrt', [49, 'sqrt', 10, 'mul'], ['0,0 7,0 7,-10']],
    ['a fixed-point operand', [{ fixed: 12.5 }], ['0,0 1.25,0 1.25,-10']],
    ['div with a fraction', [100, 7, 'div'], ['0,0 1.421875,0 1.421875,-10']],
    [
      'mul with fixed-point operands',
      [{ fixed: 123.456 }, { fixed: -7.89 }, 'mul'],
      ['0,0 -97.421875,0 -97.421875,-10'],
    ],
    [
      'div with fixed-point operands',
      [{ fixed: 123.456 }, { fixed: -7.89 }, 'div'],
      ['0,0 -1.578125,0 -1.578125,-10'],
    ],
    ['sqrt of a fraction', [{ fixed: 0.5 }, 'sqrt', 400, 'mul'], ['0,0 28.28125,0 28.28125,-10']],
    ['sqrt of a large number', [{ fixed: 1234.5678 }, 'sqrt'], ['0,0 3.5,0 3.5,-10']],
    ['sqrt of a negative number', [-4, 'sqrt', 100, 'add'], ['0,0 10,0 10,-10']],
    ['div by zero', [100, 0, 'div'], ['0,0 3277,0 3277,-10']],
    ['div of a negative number by zero', [-100, 0, 'div'], ['0,0 -3277,0 -3277,-10']],
  ] as const)('computes %s', async (_, tokens, expected) => {
    expect(await side(...tokens)).toEqual(expected);
  });

  it.each([
    ['eq', [1, 1, 'eq', 100, 'mul'], ['0,0 10,0 10,-10']],
    ['and', [1, 0, 'and', 100, 'mul'], ['0,0 0,-10']],
    ['or', [1, 0, 'or', 100, 'mul'], ['0,0 10,0 10,-10']],
    ['not', [0, 'not', 100, 'mul'], ['0,0 10,0 10,-10']],
    ['ifelse choosing the first result', [111, 222, 1, 2, 'ifelse'], ['0,0 11.09375,0 11.09375,-10']],
    ['ifelse choosing the second result', [111, 222, 2, 1, 'ifelse'], ['0,0 22.1875,0 22.1875,-10']],
  ] as const)('chooses with %s', async (_, tokens, expected) => {
    expect(await side(...tokens)).toEqual(expected);
  });

  it.each([
    ['dup', [0, 0, 'rmoveto', 100, 'dup', 'hlineto', 'vlineto', 'endchar'], ['0,0 10,0 10,-10']],
    ['exch', [0, 0, 'rmoveto', 100, 200, 'exch', 'hlineto', 'vlineto', 'endchar'], ['0,0 20,0 20,-10']],
    ['drop', [0, 0, 'rmoveto', 100, 5, 'drop', 'hlineto', 100, 'vlineto', 'endchar'], ['0,0 10,0 10,-10']],
    [
      'index',
      [0, 0, 'rmoveto', 100, 200, 300, 2, 'index', 'hlineto', 'vlineto', 'hlineto', 'endchar'],
      ['0,0 10,0 10,-20 40,-20 40,-30'],
    ],
    [
      'index of a negative distance, which copies the top',
      [0, 0, 'rmoveto', 100, 200, 300, -1, 'index', 'hlineto', 'vlineto', 'hlineto', 'vlineto', 'endchar'],
      ['0,0 10,0 10,-20 40,-20 40,-50'],
    ],
    [
      'index beyond the stack, which copies the bottom',
      [0, 0, 'rmoveto', 100, 200, 300, 9, 'index', 'hlineto', 'vlineto', 'hlineto', 'vlineto', 'endchar'],
      ['0,0 10,0 10,-20 40,-20 40,-30'],
    ],
    [
      'roll up',
      [0, 0, 'rmoveto', 100, 200, 300, 3, 1, 'roll', 'hlineto', 'vlineto', 'hlineto', 'endchar'],
      ['0,0 30,0 30,-10 50,-10'],
    ],
    [
      'roll down',
      [0, 0, 'rmoveto', 100, 200, 300, 3, -1, 'roll', 'hlineto', 'vlineto', 'hlineto', 'endchar'],
      ['0,0 20,0 20,-30 30,-30'],
    ],
    [
      'roll of the bottom operands, as FreeType does',
      [
        0,
        0,
        'rmoveto',
        7,
        100,
        200,
        300,
        3,
        1,
        'roll',
        'hlineto',
        'vlineto',
        'hlineto',
        'vlineto',
        'endchar',
      ],
      ['0,0 20,0 20,-0.6875 30,-0.6875 30,-30.6875'],
    ],
    [
      'put and get',
      [0, 0, 'rmoveto', 123, 5, 'put', 5, 'get', 'hlineto', 100, 'vlineto', 'endchar'],
      ['0,0 12.296875,0 12.296875,-10'],
    ],
    [
      'get of an empty slot',
      [0, 0, 'rmoveto', 7, 'get', 100, 'hlineto', 100, 'vlineto', 'endchar'],
      ['0,0 0,-10 0,-20'],
    ],
    [
      'put in a slot out of range, which is ignored',
      [0, 0, 'rmoveto', 100, 40, 'put', 100, 'vlineto', 'endchar'],
      ['0,0 0,-10'],
    ],
  ] as const)('moves operands with %s', async (_, tokens, expected) => {
    expect(await draw(tokens)).toEqual(expected);
  });

  it.each([
    ['too few operands', [0, 0, 'rmoveto', 100, 'add', 'hlineto', 'endchar']],
    ['a roll longer than the stack', [0, 0, 'rmoveto', 100, 5, 1, 'roll', 'hlineto', 'endchar']],
    [
      'an index with a fixed-point number',
      [0, 0, 'rmoveto', 100, 200, 1, 3, 'add', 'index', 'hlineto', 'endchar'],
    ],
  ] as const)('refuses %s', async (_, tokens) => {
    expect(await draw(tokens)).toBeNull();
  });
});

describe('CFF operands', () => {
  it('reads a 16-bit integer after the byte 28', async () => {
    expect(await draw([...MOVE, { raw: [28, 0x01, 0x2c] }, 'hlineto', 50, 'vlineto', 'endchar'])).toEqual([
      '10,-10 40,-10 40,-15',
    ]);
  });

  it('reads a byte past the end of the charstring as 0', async () => {
    expect(await draw([...MOVE, 50, 'hlineto', 50, 'vlineto', 247])).toEqual(['10,-10 15,-10 15,-15']);
  });

  it('refuses an operand stack deeper than 48', async () => {
    expect(await draw([...MOVE, ...Array<number>(48).fill(1), 'hlineto', 'endchar'])).toEqual([
      '10,-10 10.09375,-10 10.09375,-10.09375 10.1875,-10.09375 10.1875,-10.1875 10.296875,-10.1875 10.296875,-10.296875 10.390625,-10.296875 10.390625,-10.390625 10.5,-10.390625 10.5,-10.5 10.59375,-10.5 10.59375,-10.59375 10.6875,-10.59375 10.6875,-10.6875 10.796875,-10.6875 10.796875,-10.796875 10.890625,-10.796875 10.890625,-10.890625 11,-10.890625 11,-11 11.09375,-11 11.09375,-11.09375 11.1875,-11.09375 11.1875,-11.1875 11.296875,-11.1875 11.296875,-11.296875 11.390625,-11.296875 11.390625,-11.390625 11.5,-11.390625 11.5,-11.5 11.59375,-11.5 11.59375,-11.59375 11.6875,-11.59375 11.6875,-11.6875 11.796875,-11.6875 11.796875,-11.796875 11.890625,-11.796875 11.890625,-11.890625 12,-11.890625 12,-12 12.09375,-12 12.09375,-12.09375 12.1875,-12.09375 12.1875,-12.1875 12.296875,-12.1875 12.296875,-12.296875 12.390625,-12.296875 12.390625,-12.390625',
    ]);
    expect(await draw([...MOVE, ...Array<number>(49).fill(1), 'hlineto', 'endchar'])).toBeNull();
  });

  it('draws a charstring that ends without an endchar', async () => {
    expect(await draw([...MOVE, 50, 'hlineto', 50, 'vlineto'])).toEqual(['10,-10 15,-10 15,-15']);
  });

  it('ignores an operator it does not know and clears the stack', async () => {
    expect(await draw([...MOVE, 50, 'hlineto', 50, 'vlineto', { raw: [9] }, 'endchar'])).toEqual([
      '10,-10 15,-10 15,-15',
    ]);
    expect(await draw([...MOVE, 50, 'hlineto', 50, 'vlineto', { raw: [12, 40] }, 'endchar'])).toEqual([
      '10,-10 15,-10 15,-15',
    ]);
  });

  it.each([
    ['hlineto with no operand', [...MOVE, 'hlineto', 'endchar']],
    ['rlineto with an odd operand', [0, 0, 'rmoveto', 100, 200, 50, 'rlineto', 'endchar']],
    [
      'rcurveline with no operands for its line',
      [0, 0, 'rmoveto', 10, 40, 20, 50, 60, 10, 'rcurveline', 'endchar'],
    ],
    [
      'rlinecurve with a partial curve',
      [0, 0, 'rmoveto', 30, 30, 5, 5, 10, 40, 20, 50, 60, 'rlinecurve', 'endchar'],
    ],
    ['rmoveto with one operand', [10, 'rmoveto', 'endchar']],
    ['a move with nothing to move by', ['hmoveto', 'endchar']],
  ] as const)('refuses %s', async (_, tokens) => {
    expect(await draw(tokens)).toBeNull();
  });
});

describe('CFF seac', () => {
  // Standard character 65 is A (string id 34), 194 the acute accent (string id 125) and 128 has no string id.
  const A = cs(0, 0, 'rmoveto', 200, 'hlineto', 400, 'vlineto', -200, 'hlineto', 'endchar');
  const ACUTE = cs(0, 0, 'rmoveto', 50, 'hlineto', 50, 'vlineto', 'endchar');
  /** A font whose glyph 3 is the composite `tokens` end, and glyph 4 another composite. */
  const composite = (...tokens: readonly CharstringToken[]) =>
    fontOf([A, ACUTE, cs(...tokens, 'endchar'), cs(150, 700, 65, 194, 'endchar')], {
      charset: [34, 125, 35, 36],
    });

  it('draws the accent at its offset and then the base character', async () => {
    expect(await drawn(composite(150, 700, 65, 194), 3)).toEqual([
      '15,-70 20,-70 20,-75',
      '0,0 20,0 20,-40 0,-40',
    ]);
  });

  it('takes a width before the four operands', async () => {
    expect(await drawn(composite(100, 150, 700, 65, 194), 3)).toEqual([
      '15,-70 20,-70 20,-75',
      '0,0 20,0 20,-40 0,-40',
    ]);
  });

  it('keeps the contours drawn before the endchar', async () => {
    expect(
      await drawn(composite(20, 30, 'rmoveto', 40, 'hlineto', 40, 'vlineto', 150, 700, 65, 194), 3)
    ).toEqual(['2,-3 6,-3 6,-7', '15,-70 20,-70 20,-75', '0,0 20,0 20,-40 0,-40']);
  });

  it('draws the .notdef glyph for a code StandardEncoding leaves out', async () => {
    expect(await drawn(composite(150, 700, 65, 128), 3)).toEqual(['0,0 20,0 20,-40 0,-40']);
  });

  it.each([
    ['two operands', [150, 700]],
    ['three operands', [150, 700, 65]],
    ['a code beyond 255', [150, 700, 65, 300]],
    ['a negative code', [150, 700, 65, -1]],
    ['a code the charset lacks', [150, 700, 65, 200]],
    ['a fixed-point code', [150, 700, { fixed: 65 }, 194]],
    ['a composite as the base character', [150, 700, 67, 194]],
  ] as const)('refuses %s', async (_, tokens) => {
    expect(await drawn(composite(...tokens), 3)).toBeNull();
  });
});

describe('CFF font dicts', () => {
  it('gives each glyph the local subroutines of its font dict', async () => {
    const font = fontOf(
      [cs(...MOVE, -107, 'callsubr', 'endchar'), cs(...MOVE, -107, 'callsubr', 'endchar')],
      {
        fdSelect: [0, 0, 1],
        localSubrs: [
          [cs(50, 'hlineto', 50, 'vlineto', 50, 'hlineto', 'return')],
          [cs(80, 'hlineto', 80, 'vlineto', 80, 'hlineto', 'return')],
        ],
      }
    );
    expect(await drawn(font, 1)).toEqual(['10,-10 15,-10 15,-15 20,-15']);
    expect(await drawn(font, 2)).toEqual(['10,-10 18,-10 18,-18 26,-18']);
  });
});

describe('CFF charsets', () => {
  const SQUARE = (side: number) =>
    cs(0, 0, 'rmoveto', side, 'hlineto', side, 'vlineto', -side, 'hlineto', 'endchar');
  const seac = (base: number, accent: number) => cs(150, 700, base, accent, 'endchar');

  it.each([
    ['format 0', 0],
    ['format 1', 1],
    ['format 2', 2],
  ] as const)('finds a seac part in a charset of %s', async (_, charsetFormat) => {
    // Glyphs 2 and 3 are string ids 34 and 35 (A and B), which formats 1 and 2 write as one range.
    const font = fontOf([SQUARE(50), SQUARE(100), SQUARE(200), seac(66, 194)], {
      charset: [125, 34, 35, 36],
      charsetFormat,
    });
    expect(await drawn(font, 4)).toEqual(['15,-70 20,-70 20,-75 15,-75', '0,0 20,0 20,-20 0,-20']);
  });

  it('refuses a font whose charset has a format no CFF defines', async () => {
    const font = fontOf([SQUARE(50), SQUARE(100), SQUARE(200), seac(66, 194)], {
      charset: [125, 34, 35, 36],
      charsetFormat: 3,
    });
    expect(await drawn(font, 4)).toBeNull();
  });

  it('takes the first glyph a string id names', async () => {
    const font = fontOf([SQUARE(100), SQUARE(300), SQUARE(50), seac(65, 194)], {
      charset: [34, 34, 125, 35],
    });
    expect(await drawn(font, 4)).toEqual(['15,-70 20,-70 20,-75 15,-75', '0,0 10,0 10,-10 0,-10']);
  });

  it('finds a seac part in the predefined Expert charset', async () => {
    // Glyph 1 is the space (string id 1) and glyph 12 the comma (string id 13) in that charset.
    const glyphs = [
      SQUARE(100),
      ...Array.from({ length: 10 }, () => cs('endchar')),
      SQUARE(200),
      seac(32, 44),
    ];
    expect(await drawn(fontOf(glyphs, { predefinedCharset: 1 }), 13)).toEqual([
      '15,-70 35,-70 35,-90 15,-90',
      '0,0 10,0 10,-10 0,-10',
    ]);
  });

  it('refuses a font with more glyphs than its predefined charset names', async () => {
    expect(
      await drawn(
        fontOf(
          Array.from({ length: 88 }, () => SQUARE(100)),
          { predefinedCharset: 2 }
        ),
        1
      )
    ).toBeNull();
    expect(await drawn(fontOf(Array.from({ length: 229 }, () => SQUARE(100))), 1)).toBeNull();
  });
});

describe('CFF2', () => {
  const variable = (...glyphs: (readonly CharstringToken[])[]) =>
    fontOf(
      glyphs.map((tokens) => cs(...tokens)),
      { version: 2, variation: { regionCounts: [1, 3] } }
    );
  const SQUARE = [300, 'hlineto', 300, 'vlineto', -300, 'hlineto'] as const;

  it('keeps the default of a blended value and drops its deltas', async () => {
    expect(
      await drawn(variable([...MOVE, 300, 5, 6, 1, 'blend', 'hlineto', 300, 'vlineto', -300, 'hlineto']), 1)
    ).toEqual(['10,-10 40,-10 40,-10.5 40,-40.5 10,-40.5']);
  });

  it('blends several values at once', async () => {
    expect(
      await drawn(variable([...MOVE, 300, 400, 7, 8, 9, 10, 2, 'blend', 'rlineto', -300, 'hlineto']), 1)
    ).toEqual(['10,-10 40,-50 40.6875,-50.796875 10.6875,-50.796875']);
  });

  it('blends with the variation data a vsindex selects', async () => {
    expect(
      await drawn(
        variable([
          1,
          'vsindex',
          ...MOVE,
          300,
          1,
          2,
          3,
          1,
          'blend',
          'hlineto',
          300,
          'vlineto',
          -300,
          'hlineto',
        ]),
        1
      )
    ).toEqual(['10,-10 40,-10 40,-40 10,-40']);
  });

  it('blends with the variation data of the Private DICT', async () => {
    const font = fontOf([cs(...MOVE, 300, 1, 2, 3, 1, 'blend', 'hlineto', 300, 'vlineto', -300, 'hlineto')], {
      version: 2,
      variation: { regionCounts: [1, 3], vsindex: 1 },
    });
    expect(await drawn(font, 1)).toEqual(['10,-10 40,-10 40,-40 10,-40']);
  });

  it('ignores an endchar and a return', async () => {
    expect(
      await drawn(variable([...MOVE, 300, 'hlineto', 300, 'vlineto', 'endchar', -300, 'hlineto']), 1)
    ).toEqual(['10,-10 40,-10 40,-40 10,-40']);
    expect(await drawn(variable([...MOVE, ...SQUARE, 'return']), 1)).toEqual(['10,-10 40,-10 40,-40 10,-40']);
  });

  it('ignores the arithmetic operators CFF2 dropped, and clears the stack', async () => {
    expect(
      await drawn(variable([...MOVE, 300, 1, 1, 'and', 'hlineto', 300, 'vlineto', -300, 'hlineto']), 1)
    ).toEqual(['10,-10 10,-40 -20.015625,-40']);
  });

  it('does not make a seac of operands left at the end', async () => {
    expect(await drawn(variable([...MOVE, 5, 5, 'rlineto', 150, 700, 65, 194, 'endchar']), 1)).toEqual([
      '10,-10 10.5,-10.5',
    ]);
  });

  it.each([
    ['a blend one operand short', [...MOVE, 300, 400, 7, 8, 9, 2, 'blend', 'rlineto', -300, 'hlineto']],
    ['a blend of a negative count', [...MOVE, 300, 400, -1, 'blend', 'rlineto', -300, 'hlineto']],
    [
      'a vsindex the store lacks',
      [5, 'vsindex', ...MOVE, 300, 1, 2, 3, 1, 'blend', 'hlineto', 300, 'vlineto', -300, 'hlineto'],
    ],
    [
      'a vsindex after a blend',
      [...MOVE, 300, 400, 7, 8, 1, 'blend', 'rlineto', 1, 'vsindex', -300, 'hlineto'],
    ],
  ] as const)('refuses %s', async (_, tokens) => {
    expect(await drawn(variable([...tokens]), 1)).toBeNull();
  });

  it('draws a blend of no values', async () => {
    expect(await drawn(variable([...MOVE, 300, 400, 0, 'blend', 'rlineto', -300, 'hlineto']), 1)).toEqual([
      '10,-10 40,-50 10,-50',
    ]);
  });
});
