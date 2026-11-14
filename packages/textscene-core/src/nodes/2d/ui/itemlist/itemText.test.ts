/**
 * ItemList item text shaping versus Godot 4.6.3: `_shape_text` (`scene/gui/item_list.cpp:37-55`)
 * and `TextParagraph::_shape_lines` (`text_paragraph.cpp:225-266`).
 */
import { describe, expect, it } from 'vitest';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import type {} from '../../../../r3f/controls/native/solveTree';
import type {} from '../../../../r3f/controls/native/solverRegistry';
import type {} from './types';
import { ICON_MODE_LEFT } from './nativeSolver';
import { isItemListTextWrapped, shapeItemListText } from './itemText';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import type {} from '../../../../godot/math/vector';
import type {} from './nativeSolver';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { visualChars } from '../../../../r3f/controls/native/text/textLayout.testkit';

describe('shapeItemListText — direction (item_list.h:73-74)', () => {
  it('takes the direction of neutral text from the locale (`item_list.cpp:45`)', () => {
    const layout = shapeItemListText({
      text: '123!',
      fontSizePx: 16,
      fontMetrics: OPEN_SANS_FONT_METRICS,
      widthPx: 0,
      iconMode: ICON_MODE_LEFT,
      maxTextLines: 1,
      locale: 'he',
    });
    expect(visualChars(layout!.lines[0]!)).toBe('!123');
  });
});

describe('shapeItemListText — wrapping (item_list.cpp:37-55)', () => {
  const wrapInput = {
    text: 'AA AA AA',
    fontSizePx: 16,
    fontMetrics: OPEN_SANS_FONT_METRICS,
    widthPx: 30,
    overrunBehavior: 0,
    locale: '',
  };

  it('wraps only TOP icon mode with max_text_lines > 0 (happy path)', () => {
    expect(
      shapeItemListText({ ...wrapInput, iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 2 })!.lines
        .length
    ).toBeGreaterThan(1);
  });

  it('never wraps LEFT icon mode, whatever max_text_lines (error path)', () => {
    expect(
      shapeItemListText({ ...wrapInput, iconMode: ICON_MODE_LEFT, maxTextLines: 2 })!.lines
    ).toHaveLength(1);
  });

  it('never wraps TOP icon mode with max_text_lines <= 0 (edge case)', () => {
    expect(
      shapeItemListText({ ...wrapInput, iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 0 })!.lines
    ).toHaveLength(1);
  });
});

describe('shapeItemListText — overrun trim (item_list.h:131 default OVERRUN_TRIM_ELLIPSIS)', () => {
  const baseInput = {
    fontSizePx: 16,
    fontMetrics: OPEN_SANS_FONT_METRICS,
    iconMode: ICON_MODE_LEFT,
    maxTextLines: 1,
    locale: '',
  };

  /** The characters the first line draws, left to right: `line.text` keeps the untrimmed source. */
  const drawnChars = (layout: ReturnType<typeof shapeItemListText>) => visualChars(layout!.lines[0]!);

  it('trims to the shape width by default, appending an ellipsis (matches text_overrun.test.ts derivation)', () => {
    const layout = shapeItemListText({ ...baseInput, text: 'AAAAAAAAAAAA', widthPx: 100 });
    expect(drawnChars(layout)).toBe('AAAAAAAA…');
  });

  it('is a no-op at an unconstrained shape width — nothing to trim against', () => {
    const layout = shapeItemListText({ ...baseInput, text: 'AAAAAAAAAAAA', widthPx: 0 });
    expect(drawnChars(layout)).toBe('AAAAAAAAAAAA');
  });

  it('OVERRUN_NO_TRIMMING (0) leaves the text untrimmed at a constrained width', () => {
    const layout = shapeItemListText({
      ...baseInput,
      text: 'AAAAAAAAAAAA',
      widthPx: 100,
      overrunBehavior: 0,
    });
    expect(drawnChars(layout)).toBe('AAAAAAAAAAAA');
  });

  // `unit-item-list-text-direction` in Godot 4.6.3: the fill keeps the visual left part.
  it('keeps the visual left part of an AUTO Hebrew item and ends in the ellipsis', () => {
    const text = 'שלום עולם רחב מאוד';
    const whole = shapeItemListText({ ...baseInput, text, widthPx: 0 })!;
    const chars = visualChars(
      shapeItemListText({ ...baseInput, text, widthPx: whole.widthPx * 0.75 })!.lines[0]!
    );
    expect([chars[0], chars.at(-1)]).toEqual(['ד', '…']);
  });
});

/**
 * Measured through `TextParagraph` with `ItemList::_shape_text`'s break flags, overrun behaviour and
 * `max_lines_visible` (Godot 4.6.3, `item_list.cpp:37-55`), at the width each pass hands `set_width`.
 * Widths are `shaped_text_get_width`, ceiled. Heights are one 23 px line each at 16 px Open Sans.
 */
describe('shapeItemListText — against TextParagraph (text_paragraph.cpp:225-266)', () => {
  const LINE_HEIGHT_PX = 23;
  const cases = [
    // A word wider than the box breaks at the last glyph that fits (BREAK_GRAPHEME_BOUND wins).
    {
      name: 'breaks a long word per glyph',
      text: 'Supercalifragilistic',
      top: true,
      overrun: 3,
      max: 3,
      width: 56,
      lines: ['Superc', 'alifragi', 'listic'],
      widths: [54, 54, 36],
    },
    // Three lines show, the fourth hides, so the last shown line ends in an ellipsis.
    {
      name: 'ends the last visible line in an ellipsis',
      text: 'Healing potion bottle',
      top: true,
      overrun: 3,
      max: 3,
      width: 56,
      lines: ['Healin', 'g potio', 'n bot…'],
      widths: [50, 54, 54],
    },
    {
      name: 'hides lines past max_text_lines',
      text: 'Supercalifragilistic',
      top: true,
      overrun: 3,
      max: 2,
      width: 56,
      lines: ['Superc', 'alifra…'],
      widths: [54, 54],
    },
    {
      name: 'a single visible line ends in the ellipsis',
      text: 'Healing potion bottle',
      top: true,
      overrun: 3,
      max: 1,
      width: 56,
      lines: ['Heali…'],
      widths: [53],
    },
    {
      name: 'OVERRUN_NO_TRIMMING hides lines without an ellipsis',
      text: 'Supercalifragilistic',
      top: true,
      overrun: 0,
      max: 2,
      width: 56,
      lines: ['Superc', 'alifragi'],
      widths: [54, 54],
    },
    {
      name: 'OVERRUN_TRIM_CHAR keeps the hidden-line cut without an ellipsis',
      text: 'Healing potion bottle',
      top: true,
      overrun: 1,
      max: 2,
      width: 56,
      lines: ['Healin', 'g potio'],
      widths: [50, 54],
    },
    {
      name: 'OVERRUN_TRIM_WORD_ELLIPSIS cuts at a word',
      text: 'Healing potion bottle',
      top: true,
      overrun: 4,
      max: 2,
      width: 56,
      lines: ['Healin', 'g po …'],
      widths: [50, 50],
    },
    {
      name: 'OVERRUN_TRIM_ELLIPSIS_FORCE',
      text: 'Healing potion bottle',
      top: true,
      overrun: 5,
      max: 2,
      width: 56,
      lines: ['Healin', 'g pot…'],
      widths: [50, 53],
    },
    {
      name: 're-wraps at a narrower width than the text',
      text: 'Long word another',
      top: true,
      overrun: 3,
      max: 2,
      width: 54,
      lines: ['Long', 'word…'],
      widths: [38, 53],
    },
    {
      name: 'trims edge spaces at a break',
      text: 'AA   BB   CC',
      top: true,
      overrun: 3,
      max: 3,
      width: 30,
      lines: ['AA', 'BB', 'CC'],
      widths: [22, 22, 21],
    },
    {
      name: 'breaks at a mandatory newline unconstrained',
      text: 'AB\nCD',
      top: true,
      overrun: 3,
      max: 3,
      width: -1,
      lines: ['AB', 'CD'],
      widths: [22, 22],
    },
    {
      name: 'keeps a LEFT label on one line across a newline',
      text: 'AB\nCD',
      top: false,
      overrun: 3,
      max: 1,
      width: -1,
      lines: ['AB\nCD'],
      widths: [43],
    },
    {
      name: 'draws a fitting LEFT label whole under OVERRUN_TRIM_ELLIPSIS_FORCE',
      text: 'Short',
      top: false,
      overrun: 5,
      max: 1,
      width: 70,
      lines: ['Short'],
      widths: [42],
    },
    {
      name: 'draws a fitting LEFT label whole under OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
      text: 'Short',
      top: false,
      overrun: 6,
      max: 1,
      width: 70,
      lines: ['Short'],
      widths: [42],
    },
    {
      name: 'cuts an overflowing LEFT label under 6 characters without an ellipsis',
      text: 'Short',
      top: false,
      overrun: 3,
      max: 1,
      width: 30,
      lines: ['Sho'],
      widths: [29],
    },
    {
      name: 'ends an overflowing short LEFT label in an ellipsis under OVERRUN_TRIM_ELLIPSIS_FORCE',
      text: 'Short',
      top: false,
      overrun: 5,
      max: 1,
      width: 30,
      lines: ['S…'],
      widths: [22],
    },
    {
      name: 'ends an overflowing short LEFT label in a word ellipsis under OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
      text: 'A bc',
      top: false,
      overrun: 6,
      max: 1,
      width: 20,
      lines: ['…'],
      widths: [17],
    },
    {
      name: 'trims a LEFT label with an ellipsis',
      text: 'A very long item name',
      top: false,
      overrun: 3,
      max: 1,
      width: 70,
      lines: ['A very l…'],
      widths: [70],
    },
    {
      name: 'trims a LEFT label per char',
      text: 'A very long item name',
      top: false,
      overrun: 1,
      max: 1,
      width: 70,
      lines: ['A very lo'],
      widths: [67],
    },
    {
      name: 'trims a LEFT label per word',
      text: 'A very long item name',
      top: false,
      overrun: 2,
      max: 1,
      width: 70,
      lines: ['A very'],
      widths: [48],
    },
    {
      name: 'forces the LEFT ellipsis',
      text: 'A very long item name',
      top: false,
      overrun: 5,
      max: 1,
      width: 70,
      lines: ['A very l…'],
      widths: [70],
    },
    {
      name: 'leaves a LEFT label whole at OVERRUN_NO_TRIMMING',
      text: 'A very long item name',
      top: false,
      overrun: 0,
      max: 1,
      width: 70,
      lines: ['A very long item name'],
      widths: [173],
    },
    {
      name: 'leaves a LEFT label whole at zero width',
      text: 'A very long item name',
      top: false,
      overrun: 3,
      max: 1,
      width: 0,
      lines: ['A very long item name'],
      widths: [173],
    },
    {
      name: 'leaves a LEFT label whole at negative width',
      text: 'A very long item name',
      top: false,
      overrun: 3,
      max: 1,
      width: -8,
      lines: ['A very long item name'],
      widths: [173],
    },
  ];

  it.each(cases)('$name', ({ text, top, overrun, max, width, lines, widths }) => {
    const layout = shapeItemListText({
      text,
      fontSizePx: 16,
      fontMetrics: OPEN_SANS_FONT_METRICS,
      iconMode: top ? ItemListIconMode.ICON_MODE_TOP : ICON_MODE_LEFT,
      maxTextLines: max,
      locale: '',
      widthPx: width,
      overrunBehavior: overrun,
    })!;
    expect(layout.lines.map(visualChars)).toEqual(lines);
    expect(layout.lines.map((line) => shapedTextSizeWidthPx(line.widthPx))).toEqual(widths);
    expect(layout.heightPx).toBe(lines.length * LINE_HEIGHT_PX);
  });
});

describe('isItemListTextWrapped', () => {
  it('wraps TOP-mode text with max_text_lines above 0', () => {
    expect(isItemListTextWrapped(ItemListIconMode.ICON_MODE_TOP, 2)).toBe(true);
  });

  it('draws TOP-mode text with max_text_lines 0 as a single line', () => {
    expect(isItemListTextWrapped(ItemListIconMode.ICON_MODE_TOP, 0)).toBe(false);
  });

  it('draws LEFT-mode text as a single line', () => {
    expect(isItemListTextWrapped(ICON_MODE_LEFT, 2)).toBe(false);
  });
});
