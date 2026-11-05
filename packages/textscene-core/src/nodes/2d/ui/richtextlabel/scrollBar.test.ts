/**
 * Tests RichTextLabel's vertical scrollbar against `scene/gui/rich_text_label.cpp:3801-3830`. The
 * expected values are measured through `pnpm ref:godot` on `unit-rich-text-label-scrollbar.tscn`:
 * a 160x40 label shows an 8px bar over its right edge and wraps "Wave rift over" / "quiet stone
 * and" / "amber light", where the same label without the bar wraps "Wave rift over quiet" /
 * "stone and amber" / "light".
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { visualChars } from '../../../../r3f/controls/native/text/textLayout.testkit';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { resolveRichTextFaces } from './styleFaces';
import { shapeRichText, styledTextRuns } from './nativeSolver';
import { shapeBesideScrollBar } from './scrollBar';
import type { RichTextLabelProperties } from './types';

const TEXT = 'Wave rift over quiet stone and amber light';
const FONT_SIZE_PX = 16;
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const THEME = nativeTheme(1);

const label: SolveNode = {
  ...solveNode(),
  path: 'Label',
  node: controlNode('Label', 'RichTextLabel', { name: 'Label', text: TEXT }),
};

/** Shapes `TEXT` at the width the scrollbar logic asks for, as the painter does. */
function shapeAt(wrapWidthPx: number) {
  const props = label.node.properties as RichTextLabelProperties;
  const runs = styledTextRuns(label, props, WHITE, FONT_SIZE_PX, FONT_SIZE_PX, wrapWidthPx);
  const layout = shapeRichText(runs, resolveRichTextFaces(label, runs), {
    fontSizePx: FONT_SIZE_PX,
    boxWidthPx: wrapWidthPx,
    autowrapMode: AutowrapMode.AUTOWRAP_WORD_SMART,
  });
  return { runs, layout };
}

function wrappedLines(
  box: { w: number; h: number },
  scrollActive: boolean,
  rtl = false,
  scrollFollowing = false
) {
  const shaped = shapeBesideScrollBar(shapeAt, { ...box, scrollActive, rtl, scrollFollowing }, THEME);
  return { ...shaped, lines: shaped.layout.lines.map(visualChars) };
}

describe('shapeBesideScrollBar (rich_text_label.cpp:3801-3830)', () => {
  it('shows the bar and wraps beside it when the text is taller than the rect', () => {
    const { scrollBar, wrapWidthPx, lines } = wrappedLines({ w: 160, h: 40 }, true);
    expect(wrapWidthPx).toBe(152);
    expect(lines).toEqual(['Wave rift over', 'quiet stone and', 'amber light']);
    expect(scrollBar).toMatchObject({ visible: true, rect: { x: 152, y: 0, w: 8, h: 40 } });
  });

  it('puts the grabber at the top, its height the page over the text height', () => {
    const { scrollBar } = wrappedLines({ w: 160, h: 40 }, true);
    // Godot paints the grabber on rows 20 to 46 of the 20-to-59 bar: 27 rows.
    expect(scrollBar?.grabberRect).toMatchObject({ x: 0, y: 0, w: 8 });
    expect(scrollBar?.grabberRect.h).toBeGreaterThanOrEqual(26.5);
    expect(scrollBar?.grabberRect.h).toBeLessThanOrEqual(27.5);
  });

  // A layout-RTL label mirrors its anchored bar to the left edge, and every line starts after it
  // (`_draw_line`, `rich_text_label.cpp:990-996`; `control.cpp:1785-1787`).
  it('mirrors the bar to the left edge and starts the lines after it under an RTL layout', () => {
    const { scrollBar, wrapWidthPx, textOriginXPx } = wrappedLines({ w: 160, h: 40 }, true, true);
    expect(scrollBar?.rect).toEqual({ x: 0, y: 0, w: 8, h: 40 });
    expect(wrapWidthPx).toBe(152);
    expect(textOriginXPx).toBe(8);
  });

  it('starts the lines at the left edge beside a right-hand bar', () => {
    expect(wrappedLines({ w: 160, h: 40 }, true).textOriginXPx).toBe(0);
  });

  it('starts the lines at the left edge when no bar shows, whatever the layout direction', () => {
    expect(wrappedLines({ w: 160, h: 40 }, false, true).textOriginXPx).toBe(0);
  });

  // `scroll_following` sets the value to the text height (`:3827-3828`), which `Range` clamps to
  // `max - page` (`range.cpp:192-194`). Godot paints a 160x40 label's text 29 rows up, 69 - 40.
  it('scrolls the text to its foot when scroll_following is set', () => {
    const { scrollBar, scrollOffsetPx } = wrappedLines({ w: 160, h: 40 }, true, false, true);
    expect(scrollOffsetPx).toBe(29);
    // The bar covers rows 20 to 59 and the grabber rows 33 to 59.
    expect(scrollBar!.grabberRect.y).toBeCloseTo(13, 0);
    expect(scrollBar!.grabberRect.y + scrollBar!.grabberRect.h).toBeCloseTo(40, 6);
  });

  it('keeps the text at its top without scroll_following', () => {
    expect(wrappedLines({ w: 160, h: 40 }, true).scrollOffsetPx).toBe(0);
  });

  it('keeps the text at its top when it fits, whatever scroll_following says', () => {
    expect(wrappedLines({ w: 160, h: 80 }, true, false, true).scrollOffsetPx).toBe(0);
  });

  it('shows no bar and wraps at the full width when scroll_active is false', () => {
    const { scrollBar, wrapWidthPx, lines } = wrappedLines({ w: 160, h: 40 }, false);
    expect(scrollBar).toBeNull();
    expect(wrapWidthPx).toBe(160);
    expect(lines).toEqual(['Wave rift over quiet', 'stone and amber', 'light']);
  });

  it('shows no bar when the text fits the rect', () => {
    const { scrollBar, wrapWidthPx, lines } = wrappedLines({ w: 160, h: 80 }, true);
    expect(scrollBar).toBeNull();
    expect(wrapWidthPx).toBe(160);
    expect(lines).toHaveLength(3);
  });

  it('shows no bar when the text is exactly as tall as the rect', () => {
    const { scrollBar } = wrappedLines({ w: 160, h: 69 }, true);
    expect(scrollBar).toBeNull();
  });
});
