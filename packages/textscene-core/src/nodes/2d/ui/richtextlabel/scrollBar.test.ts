/**
 * Tests RichTextLabel's vertical scrollbar against `scene/gui/rich_text_label.cpp:3801-3830`. The
 * expected values are measured through `pnpm ref:godot` on `unit-rich-text-label-scrollbar.tscn`:
 * a 160x40 label shows an 8px bar over its right edge and wraps "Wave rift over" / "quiet stone
 * and" / "amber light", where the same label without the bar wraps "Wave rift over quiet" /
 * "stone and amber" / "light".
 */
import { describe, expect, it } from 'vitest';
import { defaultScrollBarBoxes } from '../shared/testing/scrollBarBoxes';
import { visualChars } from '../../../../r3f/controls/native/text/textLayout.testkit';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { resolveRichTextFaces } from './styleFaces';
import { richTextContentHeightPx, shapeRichText, styledTextRuns } from './nativeSolver';
import { shapeBesideScrollBar } from './scrollBar';
import type { RichTextLabelProperties } from './types';

const TEXT = 'Wave rift over quiet stone and amber light';
const FONT_SIZE_PX = 16;
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const BAR = defaultScrollBarBoxes(1).vertical;

/** Shapes `text` at the width the scrollbar logic asks for, as the painter does. */
function shapingOf(text: string) {
  const label: SolveNode = {
    ...solveNode(),
    path: 'Label',
    node: controlNode('Label', 'RichTextLabel', { name: 'Label', text }),
  };
  return (wrapWidthPx: number) => {
    const props = label.node.properties as RichTextLabelProperties;
    const runs = styledTextRuns(label, props, WHITE, FONT_SIZE_PX, FONT_SIZE_PX, wrapWidthPx);
    const layout = shapeRichText(runs, resolveRichTextFaces(label, runs), {
      fontSizePx: FONT_SIZE_PX,
      boxWidthPx: wrapWidthPx,
      autowrapMode: AutowrapMode.AUTOWRAP_WORD_SMART,
    });
    return { runs, layout };
  };
}

const shapeAt = shapingOf(TEXT);

function wrappedLines(
  box: { w: number; h: number },
  scrollActive: boolean,
  rtl = false,
  scrollFollowing = false
) {
  const shaped = shapeBesideScrollBar(
    shapeAt,
    { ...box, scrollActive, rtl, scrollFollowing, scrollFollowingVisibleCharacters: false },
    BAR
  );
  return { ...shaped, lines: shaped.layout.lines.map(visualChars) };
}

describe('shapeBesideScrollBar (rich_text_label.cpp:3801-3830)', () => {
  it('shows the bar and wraps beside it when the text is taller than the rect', () => {
    const { scrollBar, wrapWidthPx, lines } = wrappedLines({ w: 160, h: 40 }, true);
    expect(wrapWidthPx).toBe(152);
    expect(lines).toEqual(['Wave rift over', 'quiet stone and', 'amber light']);
    expect(scrollBar).toMatchObject({ visible: true, rect: { x: 152, y: 0, w: 8, h: 40 } });
  });

  it('reports the height of the text at the width it wrapped at', () => {
    const { contentHeightPx, layout, runs } = wrappedLines({ w: 160, h: 40 }, true);
    expect(contentHeightPx).toBe(richTextContentHeightPx(runs, layout));
    expect(contentHeightPx).toBeGreaterThan(40);
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

  // Measured through `pnpm ref:godot` on `unit-rich-text-label-scrollbar-following.tscn`'s
  // `scroll_active = false` variant: the value follows the text height with no bar showing.
  it('scrolls the text to its foot when scroll_following is set and scroll_active is not', () => {
    const { scrollBar, scrollOffsetPx } = wrappedLines({ w: 160, h: 40 }, false, false, true);
    expect(scrollBar).toBeNull();
    expect(scrollOffsetPx).toBe(29);
  });

  // A `%` image narrows with the wrap width, so the text beside the bar can be shorter than the
  // rect. `Range` clamps the value to `min` after `max - page` (`range.cpp:192-196`).
  it('keeps the text at its top when the text beside the bar is shorter than the rect', () => {
    const shorterBeside = (wrapWidthPx: number) => shapeAt(wrapWidthPx < 160 ? 1000 : wrapWidthPx);
    const box = {
      w: 160,
      h: 40,
      scrollActive: true,
      rtl: false,
      scrollFollowing: true,
      scrollFollowingVisibleCharacters: false,
    };
    expect(shapeBesideScrollBar(shorterBeside, box, BAR).scrollOffsetPx).toBe(0);
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

// `scroll_following_visible_characters` runs `_update_follow_vc` (`rich_text_label.cpp:5209-5221`) when
// the scene loads, before any line is shaped. `get_line_count()` is 0 there, so the position is the
// bar's default max, 100 (`range.h:41`), and `_notification` (`:2659-2667`) shows the bar for it
// whatever the text height. Measured through `pnpm ref:godot` on
// `unit-rich-text-label-visible-characters-follow.tscn`.
describe('shapeBesideScrollBar with scroll_following_visible_characters (rich_text_label.cpp:2659-2667)', () => {
  const FIVE_PARAGRAPHS = Array.from({ length: 5 }, () => TEXT).join('\n');

  function followingVisibleCharacters(text: string, box: { w: number; h: number }, scrollActive = true) {
    return shapeBesideScrollBar(
      shapingOf(text),
      { ...box, scrollActive, rtl: false, scrollFollowing: false, scrollFollowingVisibleCharacters: true },
      BAR
    );
  }

  it('shows the bar and wraps beside it when the text fits the rect', () => {
    const { scrollBar, wrapWidthPx, scrollOffsetPx } = followingVisibleCharacters(TEXT, { w: 160, h: 80 });
    expect(scrollBar).toMatchObject({ visible: true, rect: { x: 152, y: 0, w: 8, h: 80 } });
    expect(wrapWidthPx).toBe(152);
    expect(scrollOffsetPx).toBe(0);
  });

  it('scrolls to the foot of text taller than the rect by less than the default max', () => {
    // 69 - 40 = 29 rows, as `scroll_following`.
    expect(followingVisibleCharacters(TEXT, { w: 160, h: 40 }).scrollOffsetPx).toBe(29);
  });

  it('stops at the default max of 100 rows', () => {
    expect(followingVisibleCharacters(FIVE_PARAGRAPHS, { w: 160, h: 40 }).scrollOffsetPx).toBe(100);
  });

  it('shows no bar when scroll_active is false, but still scrolls the text', () => {
    // The value is set whether or not the bar shows (`_update_scroll_exceeds`, `:3827-3830`).
    const { scrollBar, scrollOffsetPx } = followingVisibleCharacters(
      FIVE_PARAGRAPHS,
      { w: 160, h: 40 },
      false
    );
    expect(scrollBar).toBeNull();
    expect(scrollOffsetPx).toBe(100);
  });
});
