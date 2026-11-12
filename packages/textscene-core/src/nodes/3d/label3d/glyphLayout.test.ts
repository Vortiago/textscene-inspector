import { describe, expect, it } from 'vitest';
import { OPEN_SANS_METRICS } from '../../../r3f/controls/native/text/openSansMetrics';
import { getFontLinePitchPx } from '../../../r3f/controls/native/text/fontMetrics';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { label3DAabb, layoutLabel3DLines, breakLabel3DLines, justifyLabel3DLines } from './glyphLayout';
import { labelProperties } from './testing/labelProperties';
import { textBidiOptions } from '../../../r3f/controls/native/text/textBidiOptions';
import { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import type { EnumValue } from '../../../godot/classdb/enumNames';
import { AutowrapMode, JustificationFlag } from '../../../godot/text/textServerEnums';
import type { Label3DProperties } from './types';
import { visualChars } from '../../../r3f/controls/native/text/textLayout.testkit';

const FONT_SIZE = 32;

function shapeLabel3DLinesForTest(properties: Label3DProperties) {
  return justifyLabel3DLines(breakLabel3DLines(properties, {}), properties);
}

function props(overrides: Partial<Label3DProperties> = {}): Label3DProperties {
  return labelProperties({ font_size: FONT_SIZE, ...overrides });
}

function shape(text: string, lineSpacingPx = 0) {
  return shapeLabel3DLinesForTest(props({ text, line_spacing: lineSpacingPx }));
}

function place(
  layout: ReturnType<typeof shape>,
  horizontalAlignment: EnumValue<typeof HorizontalAlignment>,
  lineSpacingPx: number,
  overrides: Partial<Label3DProperties> = {}
) {
  return layoutLabel3DLines(
    layout,
    props({ horizontal_alignment: horizontalAlignment, line_spacing: lineSpacingPx, ...overrides })
  );
}

describe('layoutLabel3DLines', () => {
  it('centres a single line vertically on the origin (label_3d.cpp VERTICAL_ALIGNMENT_CENTER default)', () => {
    const layout = shape('Hi');
    const [placement] = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 0);
    const contentHeightPx = layout.heightPx; // line_spacing 0
    expect(placement!.y).toBeCloseTo(-contentHeightPx / 2, 6);
  });

  it('each subsequent line advances by exactly one linePitchPx', () => {
    const layout = shape('A\nB\nC');
    const placements = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 0);
    expect(placements.length).toBe(3);
    expect(placements[1]!.y - placements[0]!.y).toBeCloseTo(layout.linePitchPx, 6);
    expect(placements[2]!.y - placements[1]!.y).toBeCloseTo(layout.linePitchPx, 6);
  });

  it('LEFT starts every line at x=0 regardless of its own width', () => {
    const layout = shape('A\nBB');
    const placements = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, 0);
    expect(placements[0]!.x).toBe(0);
    expect(placements[1]!.x).toBe(0);
  });

  it('CENTER centres each line independently by its own width', () => {
    const layout = shape('A\nBB');
    const placements = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 0);
    expect(placements[0]!.x).toBeCloseTo(-layout.lines[0]!.widthPx / 2, 6);
    expect(placements[1]!.x).toBeCloseTo(-layout.lines[1]!.widthPx / 2, 6);
  });

  it('RIGHT ends every line at x=0 (offset = -lineWidth)', () => {
    const layout = shape('A\nBB');
    const placements = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT, 0);
    expect(placements[0]!.x).toBeCloseTo(-layout.lines[0]!.widthPx, 6);
    expect(placements[1]!.x).toBeCloseTo(-layout.lines[1]!.widthPx, 6);
  });

  it('line_spacing widens the per-line pitch and the vertical-centring subtraction', () => {
    const withSpacing = shape('A\nB', 5);
    const placements = place(withSpacing, HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 5);
    expect(placements[1]!.y - placements[0]!.y).toBeCloseTo(
      getFontLinePitchPx(OPEN_SANS_METRICS, FONT_SIZE, 5),
      6
    );
  });

  it('an empty layout (no lines) returns an empty placement list', () => {
    // shapeText always yields at least one (possibly empty) line for '', so
    // exercise the function directly against a synthesized empty result.
    const placements = layoutLabel3DLines(
      {
        shapedText: '',
        lines: [],
        linePitchPx: getFontLinePitchPx(OPEN_SANS_METRICS, FONT_SIZE, 3),
        widthPx: 0,
        heightPx: 0,
        baselineOffsetPx: 35,
        fontMetrics: OPEN_SANS_FONT_METRICS,
      },
      props()
    );
    expect(placements).toEqual([]);
  });
});

describe('label3DAabb (the line boxes label_3d.cpp:600-606 expands its AABB over)', () => {
  const PIXEL_SIZE = 0.01;

  function aabbOf(text: string, alignment: EnumValue<typeof HorizontalAlignment>, lineSpacingPx = 0) {
    const layout = shape(text, lineSpacingPx);
    return label3DAabb(place(layout, alignment, lineSpacingPx), layout.linePitchPx, PIXEL_SIZE);
  }

  function centreOf(text: string, alignment: EnumValue<typeof HorizontalAlignment>, lineSpacingPx = 0) {
    const { position, size } = aabbOf(text, alignment, lineSpacingPx);
    return { x: position.x + size.x / 2, y: position.y + size.y / 2 };
  }

  it('centres a CENTER label on its origin', () => {
    const centre = centreOf('A\nBB', HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER);
    expect(centre.x).toBeCloseTo(0, 6);
    expect(centre.y).toBeCloseTo(0, 6);
  });

  it('lowers the centre by half the line spacing, which the last line box carries below the text', () => {
    expect(centreOf('A\nB', HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 6).y).toBeCloseTo(
      -3 * PIXEL_SIZE,
      6
    );
  });

  it('spans a LEFT label from its origin to its widest line', () => {
    const layout = shape('A\nBB');
    const widest = Math.max(...layout.lines.map((line) => Math.ceil(line.widthPx)));
    const { position, size } = aabbOf('A\nBB', HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT);
    expect([position.x, size.x]).toEqual([0, widest * PIXEL_SIZE]);
  });

  it('spans two line pitches for two lines', () => {
    const layout = shape('A\nB');
    expect(aabbOf('A\nB', HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER).size.y).toBeCloseTo(
      2 * layout.linePitchPx * PIXEL_SIZE,
      6
    );
  });

  it('leaves a label with no lines an empty AABB at the origin', () => {
    expect(label3DAabb([], getFontLinePitchPx(OPEN_SANS_METRICS, FONT_SIZE, 3), PIXEL_SIZE)).toEqual({
      position: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 },
    });
  });
});

describe('shapeLabel3DLinesForTest (label_3d.cpp:483-557)', () => {
  const lineTexts = (overrides: Partial<Label3DProperties>) =>
    shapeLabel3DLinesForTest(props(overrides)).lines.map((line) => line.text);

  it('breaks nothing at the default width 500 with autowrap off', () => {
    expect(lineTexts({ text: 'aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll' })).toHaveLength(1);
  });

  it('breaks at a word when autowrap is WORD and the line passes width', () => {
    expect(lineTexts({ text: 'aaa bbb ccc', width: 140, autowrap_mode: AutowrapMode.AUTOWRAP_WORD })).toEqual(
      ['aaa bbb', 'ccc']
    );
  });

  it('breaks inside a word that is wider than width only under WORD_SMART', () => {
    const text = 'abcdefghijkl';
    expect(lineTexts({ text, width: 100, autowrap_mode: AutowrapMode.AUTOWRAP_WORD })).toEqual([text]);
    expect(
      lineTexts({ text, width: 100, autowrap_mode: AutowrapMode.AUTOWRAP_WORD_SMART }).length
    ).toBeGreaterThan(1);
  });

  it('breaks at a grapheme under ARBITRARY', () => {
    const [first] = lineTexts({
      text: 'aaa bbb ccc',
      width: 60,
      autowrap_mode: AutowrapMode.AUTOWRAP_ARBITRARY,
    });
    expect(first!.length).toBeLessThan('aaa bbb'.length);
  });

  it('wraps nothing when width is zero or less', () => {
    expect(
      lineTexts({ text: 'aaa bbb ccc', width: 0, autowrap_mode: AutowrapMode.AUTOWRAP_WORD })
    ).toHaveLength(1);
    expect(
      lineTexts({ text: 'aaa bbb ccc', width: -5, autowrap_mode: AutowrapMode.AUTOWRAP_WORD })
    ).toHaveLength(1);
  });

  it('shapes upper case when uppercase is on', () => {
    expect(lineTexts({ text: 'abc', uppercase: true })).toEqual(['ABC']);
  });

  it('trims the spaces at both edges of a line by default, autowrap off too (label_3d.cpp:528)', () => {
    expect(lineTexts({ text: 'ab \n cd' })).toEqual(['ab', 'cd']);
  });

  it('keeps the edge spaces when autowrap_trim_flags is 0', () => {
    expect(lineTexts({ text: 'ab \n cd', autowrap_trim_flags: 0 })).toEqual(['ab \n', ' cd']);
  });
});

describe('FILL justification (label_3d.cpp:538-557)', () => {
  const FILL = HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL;
  const fillWidths = (overrides: Partial<Label3DProperties>) =>
    shapeLabel3DLinesForTest(props({ horizontal_alignment: FILL, ...overrides })).lines.map(
      (line) => line.widthPx
    );

  it('stretches a single line to width at the default flags, with autowrap off', () => {
    expect(fillWidths({ text: 'aa bb cc', width: 300 })).toEqual([300]);
  });

  it('stretches to the widest line when width is zero', () => {
    const [first, second] = fillWidths({ text: 'aa bb cc\nd e', width: 0 });
    const natural = shape('aa bb cc\nd e').lines[0]!.widthPx;
    expect(first).toBeCloseTo(natural, 6);
    expect(second).toBeLessThan(first!);
  });

  it('leaves the last line alone under SKIP_LAST_LINE', () => {
    const lines = shapeLabel3DLinesForTest(
      props({
        horizontal_alignment: FILL,
        text: 'aa bb\ncc dd',
        width: 300,
        justification_flags: JustificationFlag.WORD_BOUND | JustificationFlag.SKIP_LAST_LINE,
      })
    ).lines;
    expect(lines[0]!.widthPx).toBe(300);
    expect(lines[1]!.widthPx).toBeCloseTo(shape('cc dd').lines[0]!.widthPx, 6);
  });

  it('places a justified line from the left edge of width, centred on the origin', () => {
    const layout = shapeLabel3DLinesForTest(
      props({ horizontal_alignment: FILL, text: 'aa bb cc', width: 300 })
    );
    expect(place(layout, FILL, 0)[0]!.x).toBe(-150);
  });
});

describe('vertical_alignment and offset (label_3d.cpp:567-600)', () => {
  const TWO_LINES = 'A\nB';
  const firstLineTop = (overrides: Partial<Label3DProperties>) => {
    const layout = shape(TWO_LINES);
    return place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 0, overrides)[0]!.y;
  };
  const blockHeightPx = shape(TWO_LINES).heightPx;

  it('hangs the block below the origin for TOP', () => {
    expect(firstLineTop({ vertical_alignment: VerticalAlignment.VERTICAL_ALIGNMENT_TOP })).toBe(0);
  });

  it('centres the block for CENTER', () => {
    expect(firstLineTop({ vertical_alignment: VerticalAlignment.VERTICAL_ALIGNMENT_CENTER })).toBe(
      -blockHeightPx / 2
    );
  });

  it('stands the block above the origin for BOTTOM', () => {
    expect(firstLineTop({ vertical_alignment: VerticalAlignment.VERTICAL_ALIGNMENT_BOTTOM })).toBe(
      -blockHeightPx
    );
  });

  it('acts as TOP for FILL', () => {
    expect(firstLineTop({ vertical_alignment: VerticalAlignment.VERTICAL_ALIGNMENT_FILL })).toBe(0);
  });

  it('excludes the trailing line_spacing from the BOTTOM block height', () => {
    const layout = shape(TWO_LINES, 6);
    const [first] = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER, 6, {
      vertical_alignment: VerticalAlignment.VERTICAL_ALIGNMENT_BOTTOM,
    });
    expect(first!.y).toBe(-(layout.heightPx - 6));
  });

  it('moves every line by offset, a positive y up', () => {
    const [first] = place(shape('A'), HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, 0, {
      vertical_alignment: VerticalAlignment.VERTICAL_ALIGNMENT_TOP,
      offset: { x: 7, y: 10 },
    });
    expect([first!.x, first!.y]).toEqual([7, -10]);
  });

  it('moves the box by offset too', () => {
    const layout = shape('A');
    const at = (offset: { x: number; y: number }) =>
      label3DAabb(
        place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, 0, { offset }),
        layout.linePitchPx,
        1
      );
    const moved = at({ x: 7, y: 10 });
    const still = at({ x: 0, y: 0 });
    expect([moved.position.x - still.position.x, moved.position.y - still.position.y]).toEqual([7, 10]);
  });
});

describe('a fractional line width', () => {
  const fractionalLayout = () => {
    const layout = shape('H');
    const line = { ...layout.lines[0]!, widthPx: 10.4 };
    return { ...layout, lines: [line] };
  };

  it('aligns by the ceiled width, as shaped_text_get_width does (text_server_adv.cpp:7571)', () => {
    const [placement] = place(fractionalLayout(), HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT, 0);
    expect(placement!.x).toBe(-11);
  });

  it('spans the ceiled width in the box', () => {
    const layout = fractionalLayout();
    const placements = place(layout, HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, 0);
    expect(label3DAabb(placements, layout.linePitchPx, 1).size.x).toBe(11);
  });
});

describe('breakLabel3DLines — direction, language and structured override (label_3d.cpp:479-494)', () => {
  /** The first line's glyph characters, left to right. */
  function visual(overrides: Partial<Label3DProperties>, locale = ''): string {
    const properties = props(overrides);
    return visualChars(
      breakLabel3DLines(properties, textBidiOptions(properties, locale), OPEN_SANS_FONT_METRICS).lines[0]!
    );
  }

  it('shapes an RTL paragraph with `!` at the visual left', () => {
    expect(visual({ text: 'Hello!', textDirection: 2 })).toBe('!Hello');
  });

  it('reads the value 3 as AUTO, as a node with no layout direction passes it through', () => {
    expect(visual({ text: 'Hello!', textDirection: 3 })).toBe('Hello!');
  });

  it('takes a neutral paragraph from the language, else from the locale', () => {
    expect(visual({ text: '123!', language: 'he' })).toBe('!123');
    expect(visual({ text: '123!' }, 'he')).toBe('!123');
  });

  it('upper-cases in the case map of the language, else of the locale', () => {
    expect(visual({ text: 'istanbul', uppercase: true, language: 'tr' })).toBe('İSTANBUL');
    expect(visual({ text: 'istanbul', uppercase: true }, 'tr')).toBe('İSTANBUL');
  });

  it('keeps each FILE segment in logical order, left to right, under the structured override', () => {
    const path = 'שלום/עולם/abc.txt';
    expect(visual({ text: path, textDirection: 2, structuredTextBidiOverride: 2 })).toBe('םולש/םלוע/abc.txt');
    expect(visual({ text: path, textDirection: 2 })).toBe('abc.txt/םלוע/םולש');
  });
});
