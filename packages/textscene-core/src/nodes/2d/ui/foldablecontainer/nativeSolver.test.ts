/**
 * `foldableContainerMinimumSize`/`foldableContainerLayout` vs Godot 4.6.3
 * (`FoldableContainer::get_minimum_size`, `_update_title_min_size`,
 * `_notification`'s `NOTIFICATION_SORT_CHILDREN`, `scene/gui/foldable_container.cpp`).
 * Expected numbers reuse `button/nativeSolver.test.ts`'s worked example
 * (`unitsPerEm=2048`, `ascent=2189`, `descent=600`, 'A' hmtx advance 1354
 * design units — `content_margin`=4 all sides at scale 1, matching the
 * default-theme margin every native painter here shares).
 *
 * At font size 16, `font->get_height()` = 23 (`ceil(2189*16/2048)=18`,
 * `ceil(600*16/2048)=5`). 'A' shaped width = `ceil(1354*16/2048)` = 11.
 * `content_margin` = 4 all sides -> a margin SIZE of (8, 8). The arrow icons
 * are 16x16, `h_separation` = 2 (both at scale 1).
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
  foldableContainerMinimumSize,
  foldableContainerLayout,
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

function minSize(...args: Parameters<typeof foldableContainerMinimumSize>): Vec2 {
  const result = foldableContainerMinimumSize(...args);
  return 'size' in result ? result.size : result;
}

function layoutRects(...args: Parameters<typeof foldableContainerLayout>): ReadonlyMap<string, Rect2> {
  const result = foldableContainerLayout(...args);
  return 'rects' in result ? result.rects : result;
}

function minMeta(...args: Parameters<typeof foldableContainerMinimumSize>): FoldableContainerTitleMetrics {
  const result = foldableContainerMinimumSize(...args);
  return ('meta' in result ? result.meta : undefined) as FoldableContainerTitleMetrics;
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

  it('unfolded with a title adds the h_separation + text width/height (OVERRUN_NO_TRIMMING default)', () => {
    const meta = minMeta(node({ folded: false, title: 'A' }), ctx());
    expect(meta.size).toEqual({ x: MARGIN + ARROW + H_SEP + A_WIDTH, y: MARGIN + Math.max(FONT_HEIGHT, ARROW) });
  });

  it('a non-zero title_text_overrun_behavior drops the text WIDTH but keeps its height', () => {
    const meta = minMeta(node({ folded: false, title: 'A', titleTextOverrunBehavior: 3 }), ctx());
    expect(meta.size).toEqual({ x: MARGIN + ARROW + H_SEP, y: MARGIN + Math.max(FONT_HEIGHT, ARROW) });
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
