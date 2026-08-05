/**
 * `scrollContainerMinimumSize`/`scrollContainerScrollBars`/`scrollContainerLayout`
 * vs Godot 4.6.3 (`scene/gui/scroll_container.cpp`, `scene/gui/scroll_bar.cpp`,
 * `scene/gui/range.cpp`). Every rect/page/ratio expected value below was
 * cross-checked against the real engine: a scratch project instantiated
 * `scenes/fixtures/unit-scroll-container.tscn` in a 1152x648 `SubViewport` and
 * printed `Control.get_rect()`/`get_combined_minimum_size()` plus each
 * scrollbar's `Range` (value/min/max/page/get_as_ratio) per node — the exact
 * numbers this suite's "wired through the registry" describe block asserts.
 * The grabber's own boundary (not readable from any Control API) was measured
 * with `pnpm ref:godot scenes/fixtures/unit-scroll-container.tscn --mode 2d
 * --probe x,y`: the grabber/track colour transition falls at local y in
 * (475,476), matching the formula's predicted 476.16 (the ~1px gap is the
 * anti-aliasing feather `styleBoxFlatGeometry.ts` deliberately doesn't model).
 * Driven with synthetic `custom_minimum_size` children where the scenario
 * doesn't need the real fixture's Labels, so a font-metric regression can
 * never masquerade as a layout regression here.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { ScrollContainerProperties } from './types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import {
  scrollContainerMinimumSize,
  scrollContainerLayout,
  scrollContainerScrollBars,
  isScrollContainerLayout,
} from './nativeSolver';

/**
 * `scrollContainerLayout`'s child-rects half only — every test below except the dedicated `meta` describe cares only
 * about this, exactly like before `{ rects, meta }` existed. `'rects' in result`, not `instanceof Map`: a plain `Map`
 * is not STRUCTURALLY a subtype of the read-only `ReadonlyMap` interface's own view (see `controlRectSolver.ts`'s
 * `normalizeContainerLayoutResult`, the same discriminator this mirrors), so `instanceof` cannot safely narrow it.
 */
function layoutRects(...args: Parameters<typeof scrollContainerLayout>): ReadonlyMap<string, Rect2> {
  const result = scrollContainerLayout(...args);
  return 'rects' in result ? result.rects : result;
}

const THEME = nativeTheme(1);
// scaled.contentMargin = 4 at scale 1; a scrollbar's own thickness is
// 2 * contentMargin (scroll_bar.cpp::get_minimum_size, scroll_container.h:104-105
// default 0 separation) — see this module's own header comment.
const THICKNESS = 8;

function ctx() {
  return createSolveContext(THEME);
}

function leaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
    children: [],
    styleBoxes: {},
    textureSize: null,
  };
}

function scrollContainer(
  props: Partial<ScrollContainerProperties>,
  children: SolveNode[]
): SolveNode {
  return {
    path: 'Scroll',
    node: {
      name: 'Scroll',
      type: 'ScrollContainer',
      children: [],
      properties: { name: 'Scroll', ...props } as ScrollContainerProperties,
    },
    children,
    styleBoxes: {},
    textureSize: null,
  };
}

describe('scrollContainerMinimumSize (scene/gui/scroll_container.cpp::get_minimum_size)', () => {
  it('is (0,0) with both axes AUTO, regardless of child size (own size floors it later, not here)', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 500, y: 900 } });
    const n = scrollContainer({}, [child]);
    expect(scrollContainerMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('floors X to the largest child minimum when horizontal scrolling is DISABLED', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 120, y: 90 } });
    const n = scrollContainer({ horizontalScrollMode: 0 }, [child]);
    expect(scrollContainerMinimumSize(n, ctx())).toEqual({ x: 120, y: 0 });
  });

  it('adds the OTHER axis scrollbar thickness when it is SHOW_ALWAYS/RESERVE (scroll_container.cpp:59-62)', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 120, y: 90 } });
    const n = scrollContainer({ horizontalScrollMode: 0, verticalScrollMode: 2 }, [child]);
    expect(scrollContainerMinimumSize(n, ctx())).toEqual({ x: 120 + THICKNESS, y: 0 });
  });

  it('does the symmetric thing on Y when vertical scrolling is DISABLED', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 50, y: 4000 } });
    const n = scrollContainer({ verticalScrollMode: 0, horizontalScrollMode: 4 }, [child]);
    // horizontal_scroll_mode = RESERVE(4) also adds the reservation term.
    expect(scrollContainerMinimumSize(n, ctx())).toEqual({ x: 0, y: 4000 + THICKNESS });
  });

  it('takes the componentwise MAX of every visible child, ignoring a hidden one', () => {
    const a = leaf('Scroll/A', { customMinimumSize: { x: 100, y: 10 } });
    const b = leaf('Scroll/B', { customMinimumSize: { x: 30, y: 80 } });
    const hidden = leaf('Scroll/C', { customMinimumSize: { x: 999, y: 999 }, visible: false });
    const n = scrollContainer({ horizontalScrollMode: 0, verticalScrollMode: 0 }, [a, b, hidden]);
    expect(scrollContainerMinimumSize(n, ctx())).toEqual({ x: 100, y: 80 });
  });
});

describe('scrollContainerScrollBars (scroll_container.cpp::_update_scrollbars/_update_scrollbar_position, scroll_bar.cpp)', () => {
  const OWN_RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

  it('shows neither bar and reserves nothing when content fits both axes', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 100, y: 100 } });
    const n = scrollContainer({}, [child]);
    const out = scrollContainerScrollBars(n, ctx(), OWN_RECT);
    expect(out.horizontal.visible).toBe(false);
    expect(out.vertical.visible).toBe(false);
    expect(out.contentSize).toEqual({ x: 300, y: 200 });
  });

  it('shows only the vertical bar on vertical-only overflow (AUTO), reserving its thickness', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 120, y: 500 } });
    const n = scrollContainer({}, [child]); // both AUTO (default)
    const out = scrollContainerScrollBars(n, ctx(), OWN_RECT);
    expect(out.horizontal.visible).toBe(false);
    expect(out.vertical.visible).toBe(true);
    // reserve_vscroll = true; h reservation false (h not visible/RESERVE).
    expect(out.contentSize).toEqual({ x: 300 - THICKNESS, y: 200 });
    // v_scroll's own rect: right-aligned strip, full height (h bar invisible).
    expect(out.vertical.rect).toEqual({ x: 300 - THICKNESS, y: 0, w: THICKNESS, h: 200 });
  });

  it("dodges the OTHER bar's thickness in its own rect only when that bar is VISIBLE, not merely reserved", () => {
    // vertical_scroll_mode = RESERVE, but content fits vertically: v_scroll stays
    // invisible (RESERVE only auto-shows on overflow, like AUTO) yet still
    // reserves content width — scroll_container.cpp:592-593 / 351,357-363.
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 500, y: 100 } }); // h overflows
    const n = scrollContainer({ verticalScrollMode: 4 }, [child]);
    const out = scrollContainerScrollBars(n, ctx(), OWN_RECT);
    expect(out.vertical.visible).toBe(false);
    expect(out.horizontal.visible).toBe(true);
    // h_scroll's own rect uses vmin = v_scroll.is_visible() ? own min : 0 = 0,
    // so it spans the FULL own width even though content width is reserved.
    expect(out.horizontal.rect).toEqual({ x: 0, y: 200 - THICKNESS, w: 300, h: THICKNESS });
    // Content width IS reserved (RESERVE mode), independent of h_scroll's own rect.
    expect(out.contentSize).toEqual({ x: 300 - THICKNESS, y: 200 - THICKNESS });
  });

  it('SHOW_ALWAYS displays a bar even when content does not overflow, with a zero grabber size at zero range', () => {
    const n = scrollContainer({ verticalScrollMode: 2 }, []); // no children at all
    const out = scrollContainerScrollBars(n, ctx(), OWN_RECT);
    expect(out.vertical.visible).toBe(true);
    // get_grabber_size(): "if (range <= 0) return 0" (scroll_bar.cpp:481-483).
    expect(out.vertical.grabberRect).toEqual({ x: 0, y: 0, w: THICKNESS, h: 0 });
  });

  it("clamps page to the range (Range::set_page's own CLAMP), matching the real engine's fixture numbers", () => {
    // scenes/fixtures/unit-scroll-container.tscn at 1152x648, ScrollContainer
    // rect (16,16,1120,616): Content's combined min is (399,800) (399 from the
    // wider Label, 800 from custom_minimum_size). Oracle: h_scroll invisible,
    // max=399, page=399 (clamped down from the raw 1112 = 1120-8, since page
    // cannot exceed max); v_scroll visible, max=800, page=616 (unclamped, the
    // full own height since h_scroll is invisible).
    const child = leaf('Scroll/Content', { customMinimumSize: { x: 399, y: 800 } });
    const n = scrollContainer({}, [child]);
    const rect: Rect2 = { x: 16, y: 16, w: 1120, h: 616 };
    const out = scrollContainerScrollBars(n, ctx(), rect);
    expect(out.horizontal.visible).toBe(false);
    expect(out.vertical.visible).toBe(true);
    expect(out.vertical.rect).toEqual({ x: 1112, y: 0, w: 8, h: 616 });
    // area_size = 616 - 8 = 608; grabber_size = page/range*area + thickness
    // = 616/800*608 + 8 = 476.16 (measured boundary: between local y 475-476).
    expect(out.vertical.grabberRect.h).toBeCloseTo(476.16, 6);
    expect(out.vertical.grabberRect).toEqual({ x: 0, y: 0, w: 8, h: out.vertical.grabberRect.h });
  });

  it('offsets the grabber by area_size * get_as_ratio() when the content is scrolled', () => {
    const child = leaf('Scroll/Content', { customMinimumSize: { x: 0, y: 800 } });
    const n = scrollContainer({ scrollVertical: 200 }, [child]);
    const rect: Rect2 = { x: 0, y: 0, w: 300, h: 200 };
    const out = scrollContainerScrollBars(n, ctx(), rect);
    // range=800, area=200-8=192; ratio=clamp(200/800,0,1)=0.25; offset=192*0.25=48.
    expect(out.vertical.grabberRect.y).toBeCloseTo(48, 6);
  });
});

describe('scrollContainerLayout (scroll_container.cpp::_reposition_children)', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

  it('sizes a non-EXPAND child to its own minimum, unaffected by the container size', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 399, y: 800 } });
    const n = scrollContainer({}, [child]);
    const children = [{ node: child, minSize: { x: 399, y: 800 } }];
    const out = layoutRects(n, children, RECT, ctx());
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: 0, w: 399, h: 800 });
  });

  it('stretches an EXPAND child to the content viewport when the container is bigger than its minimum', () => {
    const child = leaf('Scroll/Child', {
      customMinimumSize: { x: 50, y: 50 },
      sizeFlagsHorizontal: 3, // FILL|EXPAND
      sizeFlagsVertical: 3,
    });
    const n = scrollContainer({}, [child]);
    const children = [{ node: child, minSize: { x: 50, y: 50 } }];
    const out = layoutRects(n, children, RECT, ctx());
    // No scrollbar shows (child's minimum fits both axes): contentSize = own rect.
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('shrinks the EXPAND target when a scrollbar is reserved on that axis (child overflows vertically)', () => {
    const child = leaf('Scroll/Child', {
      customMinimumSize: { x: 50, y: 500 },
      sizeFlagsHorizontal: 3,
      sizeFlagsVertical: 1, // FILL only on Y — height stays at its own minimum
    });
    const n = scrollContainer({}, [child]);
    const children = [{ node: child, minSize: { x: 50, y: 500 } }];
    const out = layoutRects(n, children, RECT, ctx());
    // vertical overflow (500 > 200) shows the v-bar, reserving 8px of width.
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: 0, w: 300 - 8, h: 500 });
  });

  it('shifts the child by the NEGATIVE authored scroll offset (scroll_container.cpp:372)', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 50, y: 50 } });
    const n = scrollContainer({ scrollHorizontal: 30, scrollVertical: 70 }, [child]);
    const children = [{ node: child, minSize: { x: 50, y: 50 } }];
    const out = layoutRects(n, children, RECT, ctx());
    expect(out.get('Scroll/Child')).toEqual({ x: -30, y: -70, w: 50, h: 50 });
  });

  it('lays out every visible child against the SAME content rect (multiple children is a misconfiguration Godot warns about but still lays out)', () => {
    const a = leaf('Scroll/A', { customMinimumSize: { x: 10, y: 10 } });
    const b = leaf('Scroll/B', { customMinimumSize: { x: 20, y: 20 } });
    const n = scrollContainer({}, [a, b]);
    const children = [
      { node: a, minSize: { x: 10, y: 10 } },
      { node: b, minSize: { x: 20, y: 20 } },
    ];
    const out = layoutRects(n, children, RECT, ctx());
    expect(out.get('Scroll/A')).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(out.get('Scroll/B')).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });
});

describe('scrollContainerLayout — meta carries the FULL ScrollContainerLayout (ITEM A: no fresh SolveContext in the painter)', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

  it('meta is the SAME object scrollContainerScrollBars would compute for this node/ctx/rect — not a re-derivation', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 120, y: 500 } });
    const n = scrollContainer({}, [child]);
    const children = [{ node: child, minSize: { x: 120, y: 500 } }];
    const solveCtx = ctx();

    const result = scrollContainerLayout(n, children, RECT, solveCtx);
    const expected = scrollContainerScrollBars(n, solveCtx, RECT);

    expect(result).not.toBeInstanceOf(Map);
    // `'rects' in result`, not `instanceof Map`: see `layoutRects`'s own doc for why.
    if (!('rects' in result)) throw new Error('unreachable');
    expect(isScrollContainerLayout(result.meta)).toBe(true);
    expect(result.meta).toEqual(expected);
  });
});

describe('wired through the registry + full solve, against the real fixture numbers', () => {
  const TYPE = 'ScrollContainer';

  it('reproduces scenes/fixtures/unit-scroll-container.tscn: Content stays at its natural (399,800) rect', () => {
    controlSolverRegistry.registerMinimumSize(TYPE, scrollContainerMinimumSize);
    controlSolverRegistry.registerContainerLayout(TYPE, scrollContainerLayout);
    try {
      const content: SolveNode = {
        path: 'Root/ScrollContainer/Content',
        node: {
          name: 'Content',
          type: 'VBoxContainer',
          children: [],
          properties: { name: 'Content', customMinimumSize: { x: 399, y: 800 } } as ControlProperties,
        },
        children: [],
        styleBoxes: {},
        textureSize: null,
      };
      const scroll: SolveNode = {
        path: 'Root/ScrollContainer',
        node: {
          name: 'ScrollContainer',
          type: TYPE,
          children: [],
          properties: {
            name: 'ScrollContainer',
            anchorsPreset: 15,
            anchorRight: 1,
            anchorBottom: 1,
            offsetLeft: 16,
            offsetTop: 16,
            offsetRight: -16,
            offsetBottom: -16,
          } as ScrollContainerProperties,
        },
        children: [content],
        styleBoxes: {},
        textureSize: null,
      };
      const root: SolveNode = {
        path: 'Root',
        node: {
          name: 'Root',
          type: 'Control',
          children: [],
          properties: { name: 'Root', anchorsPreset: 15, anchorRight: 1, anchorBottom: 1 } as ControlProperties,
        },
        children: [scroll],
        styleBoxes: {},
        textureSize: null,
      };

      const viewport: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
      const solved = solveControlTree([root], viewport, ctx());
      expect(solved.get('Root/ScrollContainer')?.rect).toEqual({ x: 16, y: 16, w: 1120, h: 616 });
      expect(solved.get('Root/ScrollContainer/Content')?.rect).toEqual({ x: 0, y: 0, w: 399, h: 800 });
    } finally {
      controlSolverRegistry.clear();
    }
  });
});
