/**
 * FoldableContainer solve against Godot 4.6.3 (`scene/gui/foldable_container.cpp`), with
 * the font of `button/nativeSolver.test.ts`: at size 16 the height is 23 (18 + 5) and 'A'
 * is 11 wide. At scale 1, `content_margin` is 4 per side, the arrows are 16x16 and
 * `h_separation` is 2.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { FoldableContainerProperties } from './types';
import {
  foldableContainerChildVisibility,
  foldableContainerMinimumSize,
  foldableContainerLayout,
  foldableContainerHSeparation,
  foldableContainerArrowSize,
  foldableContainerTitleMetrics,
  foldableContainerTitleShape,
  type FoldableContainerTitleMetrics,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const MARGIN = 8; // content_margin 4, both sides.
const FONT_HEIGHT = 23;
const A_WIDTH = 11; // ceil(1354 * 16 / 2048)
const ARROW = 16;
const H_SEP = 2;

function node(
  props: Partial<FoldableContainerProperties>,
  children: SolveNode[] = [],
  path = 'F'
): SolveNode {
  return {
    ...solveNode(),
    path,
    node: {
      name: path,
      type: 'FoldableContainer',
      children: [] as TscnNode[],
      properties: { name: path, ...props } as FoldableContainerProperties,
    },
    children,
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText,
    combinedMinimumSize: (n) => (n.node.properties as { minSize?: Vec2 }).minSize ?? { x: 0, y: 0 },
  };
}

const minSize = foldableContainerMinimumSize;

function layoutRects(...args: Parameters<typeof foldableContainerLayout>): ReadonlyMap<string, Rect2> {
  const result = foldableContainerLayout(...args);
  return 'rects' in result ? result.rects : result;
}

/** The share both solver entry points and the painter call. */
function titleShape(n: SolveNode): FoldableContainerTitleMetrics {
  return foldableContainerTitleShape(n, nativeTheme(1));
}

describe('foldableContainerMinimumSize', () => {
  it('folded with an empty title sizes to the title bar alone: margin + arrow, both axes', () => {
    expect(minSize(node({ folded: true }), ctx())).toEqual({ x: MARGIN + ARROW, y: MARGIN + ARROW });
  });

  it('folded ignores children entirely — title_minimum_size IS the whole size', () => {
    const child = node({}, []);
    (child.node.properties as unknown as { minSize: Vec2 }).minSize = { x: 500, y: 500 };
    expect(minSize(node({ folded: true }, [child]), ctx())).toEqual({ x: MARGIN + ARROW, y: MARGIN + ARROW });
  });

  it('widens on a themed "folded_arrow" icon (foldable_container.cpp:441-450: title_minimum_size.width += icon->get_width())', () => {
    const themed = { ...node({ folded: true }), textureSlots: { folded_arrow: { x: 24, y: 20 } } };
    expect(minSize(themed, ctx())).toEqual({ x: MARGIN + 24, y: MARGIN + 20 });
  });

  it('ignores a themed "expanded_arrow" while folded — only the CURRENT arrow (folded) counts', () => {
    const themed = { ...node({ folded: true }), textureSlots: { expanded_arrow: { x: 99, y: 99 } } };
    expect(minSize(themed, ctx())).toEqual({ x: MARGIN + ARROW, y: MARGIN + ARROW });
  });

  it('unfolded with a title adds the h_separation + text width/height (OVERRUN_NO_TRIMMING default)', () => {
    const title = titleShape(node({ folded: false, title: 'A' }));
    expect(title.size).toEqual({ x: MARGIN + ARROW + H_SEP + A_WIDTH, y: MARGIN + Math.max(FONT_HEIGHT, ARROW) });
  });

  it('a non-zero title_text_overrun_behavior drops the text WIDTH but keeps its height', () => {
    const title = titleShape(node({ folded: false, title: 'A', titleTextOverrunBehavior: 3 }));
    expect(title.size).toEqual({ x: MARGIN + ARROW + H_SEP, y: MARGIN + Math.max(FONT_HEIGHT, ARROW) });
  });

  it('unfolded with no children floors to the title bar width and adds the panel margin height', () => {
    const titleWidth = MARGIN + ARROW + H_SEP + A_WIDTH;
    const titleHeight = MARGIN + Math.max(FONT_HEIGHT, ARROW);
    expect(minSize(node({ folded: false, title: 'A' }), ctx())).toEqual({
      x: Math.max(MARGIN, titleWidth),
      y: MARGIN + titleHeight,
    });
  });

  it("unfolded sizes to the widest visible child's combined minimum size, plus the panel margin", () => {
    const child = node({});
    (child.node.properties as unknown as { minSize: Vec2 }).minSize = { x: 200, y: 40 };
    const result = minSize(node({ folded: false }, [child]), ctx());
    expect(result.x).toBe(200 + MARGIN);
    expect(result.y).toBe(40 + MARGIN + (MARGIN + ARROW)); // no title text: title height = margin + arrow
  });

  it('skips a hidden child when aggregating the unfolded minimum size', () => {
    const child = node({ visible: false });
    (child.node.properties as unknown as { minSize: Vec2 }).minSize = { x: 999, y: 999 };
    const result = minSize(node({ folded: false }, [child]), ctx());
    // No visible child contributes: width floors to the (empty) title bar's own, MARGIN + ARROW.
    expect(result.x).toBe(MARGIN + ARROW);
  });
});

describe('foldableContainerLayout', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 100, h: 100 };

  it('returns no rects at all when folded', () => {
    const rects = layoutRects(node({ folded: true }), [], RECT, ctx());
    expect(rects.size).toBe(0);
  });

  it('fits the content BELOW the title bar at title_position TOP (default)', () => {
    const container = node({ folded: false, title: 'A' });
    const child = node({}, [], 'Child');
    const rects = layoutRects(
      container,
      [{ node: child, minSize: { x: 10, y: 10 } }],
      RECT,
      ctx()
    );
    const titleHeight = MARGIN + Math.max(FONT_HEIGHT, ARROW); // 31
    const rect = rects.get('Child')!;
    expect(rect.y).toBe(4 + titleHeight);
    expect(rect.x).toBe(4);
    expect(rect.h).toBe(100 - 4 - 4 - titleHeight);
  });

  it('fits the content ABOVE the title bar at title_position BOTTOM', () => {
    const container = node({ folded: false, title: 'A', titlePosition: 1 });
    const child = node({}, [], 'Child');
    const rects = layoutRects(
      container,
      [{ node: child, minSize: { x: 10, y: 10 } }],
      RECT,
      ctx()
    );
    const rect = rects.get('Child')!;
    expect(rect.y).toBe(4);
  });
});

describe('foldableContainerHSeparation / foldableContainerArrowSize (default_theme.cpp:1336, scene/theme/icons/arrow_*.svg)', () => {
  it('h_separation is round(2*scale); the arrow icons are round(16*scale) square', () => {
    expect(foldableContainerHSeparation(nativeTheme(1))).toBe(2);
    expect(foldableContainerArrowSize(nativeTheme(1))).toEqual({ x: 16, y: 16 });
  });

  it('both move with a non-1 theme scale', () => {
    expect(foldableContainerHSeparation(nativeTheme(1.5))).toBe(3);
    expect(foldableContainerArrowSize(nativeTheme(1.5))).toEqual({ x: 24, y: 24 });
  });
});

describe('FoldableContainer under RTL', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 100, h: 100 };

  /** The default panel StyleBox with asymmetric horizontal margins, so a left/right swap is visible. */
  function lopsidedPanel(container: SolveNode) {
    const base = foldableContainerTitleMetrics(
      container,
      container.node.properties as FoldableContainerProperties,
      ctx(),
      true
    ).panelStyle;
    return { ...base, contentMargin: { ...base.contentMargin, left: 2, right: 9 } };
  }

  it('picks folded_arrow_mirrored when folded (foldable_container.cpp:428-435)', () => {
    // `} else if (is_layout_rtl()) { return theme_cache.folded_arrow_mirrored; }`
    const container = { ...node({ folded: true }), rtl: true };
    const title = foldableContainerTitleMetrics(
      container,
      container.node.properties as FoldableContainerProperties,
      ctx(),
      true
    );
    expect(title.arrow).toBe('foldedMirrored');
  });

  it('keeps the expanded arrow unmirrored — the RTL branch is folded-only (foldable_container.cpp:428-435)', () => {
    const container = { ...node({ folded: false }), rtl: true };
    const title = foldableContainerTitleMetrics(
      container,
      container.node.properties as FoldableContainerProperties,
      ctx(),
      true
    );
    expect(title.arrow).toBe('expanded');
  });

  it("insets the content from the panel style's RIGHT margin instead of its left (foldable_container.cpp:365-367)", () => {
    // `inner_rect.position.x = rtl ? panel_style->get_margin(SIDE_RIGHT)
    //                              : panel_style->get_margin(SIDE_LEFT)`;
    // the width subtracts both margins.
    const container = { ...node({ folded: false, title: 'A' }), rtl: true };
    const withPanel = { ...container, styleBoxes: { panel: lopsidedPanel(container) } };
    const child = node({}, [], 'Child');
    const rects = layoutRects(withPanel, [{ node: child, minSize: { x: 10, y: 10 } }], RECT, ctx());
    const rect = rects.get('Child')!;
    expect(rect.x).toBe(9);
    expect(rect.w).toBe(100 - 2 - 9);
  });

  it('hands its own rtl to fit_child_in_rect, so a non-FILL child sits at the inner rect trailing edge (container.cpp:99,109)', () => {
    const container = { ...node({ folded: false, title: 'A' }), rtl: true };
    const child = node({ sizeFlagsHorizontal: 0 } as Partial<FoldableContainerProperties>, [], 'Child');
    const rects = layoutRects(container, [{ node: child, minSize: { x: 10, y: 10 } }], RECT, ctx());
    // The inner rect is (4, ..., 92, ...); a 10-wide child lands at 4 + 92 - 10.
    expect(rects.get('Child')!.x).toBe(86);
  });
});

describe('foldableContainerChildVisibility — `c->set_visible(!folded)` (foldable_container.cpp:381)', () => {
  /** Godot's loop writes the same value to every child, so the per-child arguments are inert here. */
  const answerFor = (properties: Partial<FoldableContainerProperties>) => {
    const container = node(properties).node;
    return foldableContainerChildVisibility(container, container, 0, 1);
  };

  it('clears the children of a folded container', () => {
    expect(answerFor({ folded: true })).toBe(false);
  });

  it('sets the children of an unfolded container, rather than leaving them alone', () => {
    expect(answerFor({ folded: false })).toBe(true);
  });

  it('treats an absent/malformed `folded` as the property default, false', () => {
    expect(answerFor({})).toBe(true);
  });

  it('answers the same for every child index, unlike TabContainer’s own writer', () => {
    const container = node({ folded: true }).node;
    expect([0, 1, 2].map((i) => foldableContainerChildVisibility(container, container, i, 3))).toEqual([
      false,
      false,
      false,
    ]);
  });
});
