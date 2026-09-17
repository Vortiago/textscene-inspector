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
  scrollContainerLayoutChannel,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

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
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
  };
}

function scrollContainer(
  props: Partial<ScrollContainerProperties>,
  children: SolveNode[]
): SolveNode {
  return {
    ...solveNode(),
    path: 'Scroll',
    node: {
      name: 'Scroll',
      type: 'ScrollContainer',
      children: [],
      properties: { name: 'Scroll', ...props } as ScrollContainerProperties,
    },
    children,
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

  it('never lets an over-range authored offset push the grabber past the end of its track', () => {
    // The grabber's ratio reads the SETTLED value, so its far edge lands
    // exactly on the track's: offset = area * (600/800) = 144, size = 200/800
    // * 192 + 8 = 56, and 144 + 56 = 200 = the bar's own length. Reading the
    // raw authored value instead put the grabber at the full area_size and
    // drew it hanging off the end.
    const child = leaf('Scroll/Content', { customMinimumSize: { x: 0, y: 800 } });
    const n = scrollContainer({ scrollVertical: 5000 }, [child]);
    const out = scrollContainerScrollBars(n, ctx(), { x: 0, y: 0, w: 300, h: 200 });
    expect(out.vertical.grabberRect.y).toBeCloseTo(144, 6);
    expect(out.vertical.grabberRect.y + out.vertical.grabberRect.h).toBeCloseTo(out.vertical.rect.h, 6);
  });

  it('keeps a fractional bar rect at FULL precision — the whole-pixel snap belongs to the drawn transform, not the solve', () => {
    // `Control::_update_canvas_item_transform` floors the CANVAS ITEM's
    // translation and leaves `get_rect()` untouched, so a ScrollBar whose own
    // origin lands on a half pixel still reports that half pixel — the
    // container's own reservation arithmetic below reads these numbers, and
    // rounding them here would feed the solve its own rendering compromise.
    const child = leaf('Scroll/Content', { customMinimumSize: { x: 1200, y: 900 } });
    const n = scrollContainer({}, [child]);
    const out = scrollContainerScrollBars(n, ctx(), { x: 0, y: 0, w: 900.5, h: 600.5 });
    expect(out.horizontal.rect).toEqual({ x: 0, y: 592.5, w: 892.5, h: 8 });
    expect(out.vertical.rect).toEqual({ x: 892.5, y: 0, w: 8, h: 592.5 });
    expect(out.contentSize).toEqual({ x: 892.5, y: 592.5 });
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
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 50, y: 800 } });
    const n = scrollContainer({ scrollVertical: 200 }, [child]);
    const children = [{ node: child, minSize: { x: 50, y: 800 } }];
    const out = layoutRects(n, children, RECT, ctx());
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: -200, w: 50, h: 800 });
  });

  it('settles an authored offset past `max - page` AT `max - page`, never further', () => {
    // `Range::_calc_value` (`range.cpp:191-193`): a value above `max - page`
    // is pinned there before the `min` clamp below it. `ScrollContainer::
    // _update_scrollbars` (`:598-599`) gives the v-bar `max` = the largest
    // child minimum and `page` = the content viewport height, and BOTH
    // `Range::set_max` and `Range::set_page` re-run `set_value(val)`
    // (`range.cpp`), so the settled value is clamped however late the sizes
    // arrive. Engine-checked: authoring 5000 here settles at 600.
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 50, y: 800 } });
    const n = scrollContainer({ scrollVertical: 5000 }, [child]);
    const children = [{ node: child, minSize: { x: 50, y: 800 } }];
    const out = layoutRects(n, children, RECT, ctx());
    // max 800 - page 200 = 600, so the child's last row sits on the viewport's.
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: -600, w: 50, h: 800 });
  });

  it('ignores an authored offset entirely when the content does not overflow', () => {
    // `Range::set_page` CLAMPs page to `max - min` (`range.cpp:254-256`), so a
    // viewport wider than the content gives `page == max` and `max - page ==
    // 0`: every authored offset settles at 0 and the child never moves.
    // Engine-checked: `scroll_horizontal = 30`/`scroll_vertical = 70` on a
    // 300x200 container holding a 50x50 child both read back 0.
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 50, y: 50 } });
    const n = scrollContainer({ scrollHorizontal: 30, scrollVertical: 70 }, [child]);
    const children = [{ node: child, minSize: { x: 50, y: 50 } }];
    const out = layoutRects(n, children, RECT, ctx());
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: 0, w: 50, h: 50 });
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

describe('scrollContainerLayout — the sealed solve handoff carries the FULL ScrollContainerLayout', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

  it('seals the SAME object scrollContainerScrollBars would compute for this node/ctx/rect — not a re-derivation', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 120, y: 500 } });
    const n = scrollContainer({}, [child]);
    const children = [{ node: child, minSize: { x: 120, y: 500 } }];
    const solveCtx = ctx();

    const result = scrollContainerLayout(n, children, RECT, solveCtx);
    const expected = scrollContainerScrollBars(n, solveCtx, RECT);

    expect(result).not.toBeInstanceOf(Map);
    // `'rects' in result`, not `instanceof Map`: see `layoutRects`'s own doc for why.
    if (!('rects' in result)) throw new Error('unreachable');
    expect(scrollContainerLayoutChannel.open(result.meta)).toEqual(expected);
  });
});

describe('wired through the registry + full solve, against the real fixture numbers', () => {
  const TYPE = 'ScrollContainer';

  it('reproduces scenes/fixtures/unit-scroll-container.tscn: Content stays at its natural (399,800) rect', () => {
    controlSolverRegistry.registerMinimumSize(TYPE, scrollContainerMinimumSize);
    controlSolverRegistry.registerContainerLayout(TYPE, scrollContainerLayout);
    try {
      const content: SolveNode = {
        ...solveNode(),
        path: 'Root/ScrollContainer/Content',
        node: {
          name: 'Content',
          type: 'VBoxContainer',
          children: [],
          properties: { name: 'Content', customMinimumSize: { x: 399, y: 800 } } as ControlProperties,
        },
      };
      const scroll: SolveNode = {
        ...solveNode(),
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
      };
      const root: SolveNode = {
        ...solveNode(),
        path: 'Root',
        node: {
          name: 'Root',
          type: 'Control',
          children: [],
          properties: { name: 'Root', anchorsPreset: 15, anchorRight: 1, anchorBottom: 1 } as ControlProperties,
        },
        children: [scroll],
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

describe('ScrollContainer under RTL', () => {
  const OWN_RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

  it('puts the vertical bar on the leading (left) edge and shortens the horizontal bar from the left (scroll_container.cpp:297-305, control.cpp:1785-1787)', () => {
    // Both bars are anchored children, so `Control::_size_changed` mirrors each
    // one's rect against the container width. LTR the v bar spans
    // [300-8, 300] and the h bar [0, 300-8]; RTL is the mirror of both.
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 500, y: 500 } });
    const n = { ...scrollContainer({}, [child]), rtl: true };
    const out = scrollContainerScrollBars(n, ctx(), OWN_RECT);
    expect(out.vertical.visible).toBe(true);
    expect(out.horizontal.visible).toBe(true);
    expect(out.vertical.rect).toEqual({ x: 0, y: 0, w: THICKNESS, h: 200 - THICKNESS });
    expect(out.horizontal.rect).toEqual({ x: THICKNESS, y: 200 - THICKNESS, w: 300 - THICKNESS, h: THICKNESS });
  });

  it('offsets the content past the reserved vertical strip (scroll_container.cpp:350,357-363)', () => {
    // `if (reserve_vscroll) { size.x -= width; if (rtl) ofs.x += width; }`,
    // then `r.position += ofs`. The child is not mirrored again: Godot reaches
    // it through `fit_child_in_rect`/`set_rect`, whose `_compute_offsets`
    // un-mirrors exactly what `_size_changed` mirrors back.
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 100, y: 500 } });
    const n = { ...scrollContainer({}, [child]), rtl: true };
    const out = layoutRects(n, [{ node: child, minSize: { x: 100, y: 500 } }], OWN_RECT, ctx());
    expect(out.get('Scroll/Child')).toEqual({ x: THICKNESS, y: 0, w: 100, h: 500 });
  });

  it('leaves the content at the origin when no vertical strip is reserved (scroll_container.cpp:357)', () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 500, y: 100 } });
    const n = { ...scrollContainer({}, [child]), rtl: true };
    const out = layoutRects(n, [{ node: child, minSize: { x: 500, y: 100 } }], OWN_RECT, ctx());
    expect(out.get('Scroll/Child')).toEqual({ x: 0, y: 0, w: 500, h: 100 });
  });

  it("hands its own rtl to fit_child_in_rect, so a non-FILL child sits at the content strip's trailing edge (container.cpp:99,109)", () => {
    const child = leaf('Scroll/Child', {
      customMinimumSize: { x: 40, y: 20 },
      sizeFlagsHorizontal: 2, // EXPAND without FILL
      sizeFlagsVertical: 0,
    });
    const n = { ...scrollContainer({}, [child]), rtl: true };
    const out = layoutRects(n, [{ node: child, minSize: { x: 40, y: 20 } }], OWN_RECT, ctx());
    // EXPAND stretches the rect to the 300-wide content viewport (no bar
    // shows), then fit_child_in_rect drops it back to 40 at 300 - 40.
    expect(out.get('Scroll/Child')).toEqual({ x: 260, y: 0, w: 40, h: 20 });
  });
});
