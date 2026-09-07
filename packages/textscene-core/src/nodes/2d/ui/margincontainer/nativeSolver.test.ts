/**
 * `marginContainerMinimumSize`/`marginContainerLayout` vs Godot 4.6.3
 * (`scene/gui/margin_container.cpp`, `scene/gui/container.cpp`). Every
 * expected rect below was cross-checked against the real engine: a scratch
 * project instantiated the equivalent scene tree in a `SubViewport` sized
 * 1152×648 (this repo's `DEFAULT_VIEWPORT_WIDTH`/`HEIGHT` fallback) and
 * printed `Control.get_rect()`/`get_combined_minimum_size()` per node — see
 * the same probe technique the sibling container suites use. Children are synthetic
 * `custom_minimum_size` Controls, never Labels, so a font-metric regression
 * and a `_resort` regression can never present as the same test failure.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, ContainerLayoutResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { marginContainerMinimumSize, marginContainerLayout } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

/** `marginContainerLayout`'s `rects` half only — see `ContainerLayoutResult`'s own doc for why the union is here at all. */
function asMap(
  result: ReadonlyMap<string, Rect2> | ContainerLayoutResult
): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

function leaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
  };
}

function container(name: string, props: Partial<ControlProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'MarginContainer',
      children: [],
      properties: { name, ...props } as ControlProperties,
    },
    children,
  };
}

/** No registered per-type minimum size in these tests: only `custom_minimum_size` floors. */
function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: (n) => (n.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  };
}

describe('marginContainerMinimumSize', () => {
  it('sizes to the single child combined minimum plus its four margins (margin_container.cpp:35-57)', () => {
    const child = leaf('Leaf', { customMinimumSize: { x: 40, y: 20 } });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 10, margin_top: 5, margin_right: 20, margin_bottom: 15 } },
      [child]
    );
    expect(marginContainerMinimumSize(n, ctx())).toEqual({ x: 40 + 10 + 20, y: 20 + 5 + 15 });
  });

  it('takes the componentwise max across multiple children, ignoring size flags (margin_container.cpp:44-50)', () => {
    const a = leaf('A', { customMinimumSize: { x: 30, y: 80 } });
    const b = leaf('B', { customMinimumSize: { x: 90, y: 20 }, sizeFlagsHorizontal: 4, sizeFlagsVertical: 8 });
    const n = container('M', {}, [a, b]);
    // No theme_override_constants set: default_theme.cpp:1252-1255 sets all
    // four margins to 0 (unscaled), so the container's own minimum is exactly
    // the componentwise max of its children.
    expect(marginContainerMinimumSize(n, ctx())).toEqual({ x: 90, y: 80 });
  });

  it('skips an invisible child (margin_container.cpp:39, SortableVisibilityMode::VISIBLE)', () => {
    const visible = leaf('Visible', { customMinimumSize: { x: 10, y: 10 } });
    const hidden = leaf('Hidden', { customMinimumSize: { x: 999, y: 999 }, visible: false });
    const n = container('M', {}, [visible, hidden]);
    expect(marginContainerMinimumSize(n, ctx())).toEqual({ x: 10, y: 10 });
  });
});

describe('marginContainerLayout', () => {
  const viewport = { x: 0, y: 0, w: 1152, h: 648 };

  it('fills the padded content box for a SIZE_FILL child (Control default) — oracle: Leaf rect=[32,16,1088,616]', () => {
    const child = leaf('Leaf', { customMinimumSize: { x: 500, y: 500 } });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 32, margin_top: 16, margin_right: 32, margin_bottom: 16 } },
      [child]
    );
    const rects = asMap(marginContainerLayout(n, [{ node: child, minSize: { x: 500, y: 500 } }], viewport, ctx()));
    // FILL ignores the child's own minimum size entirely (container.cpp:103,114
    // — the shrink branch that reads `minsize` is inside `if (!FILL)`), so a
    // minimum LARGER than the padded box still yields the padded box verbatim.
    expect(rects.get('Leaf')).toEqual({ x: 32, y: 16, w: 1088, h: 616 });
  });

  it('shrinks a non-FILL child to its own minimum, SHRINK_CENTER one axis + SHRINK_END the other — oracle: Leaf rect=[525,537,101,61]', () => {
    const child = leaf('Leaf', {
      customMinimumSize: { x: 101, y: 61 },
      sizeFlagsHorizontal: 4, // SIZE_SHRINK_CENTER
      sizeFlagsVertical: 8, // SIZE_SHRINK_END
    });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 50, margin_top: 50, margin_right: 50, margin_bottom: 50 } },
      [child]
    );
    const rects = asMap(marginContainerLayout(n, [{ node: child, minSize: { x: 101, y: 61 } }], viewport, ctx()));
    // Padded box: (50,50,1052,548). Horizontal: floor((1052-101)/2)=475 → x=525.
    // Vertical: SHRINK_END offsets by the full remainder, not halved: 548-61=487 → y=537.
    expect(rects.get('Leaf')).toEqual({ x: 525, y: 537, w: 101, h: 61 });
  });

  it("claws an EXPAND-without-FILL child back to its minimum, pinned to the begin edge — oracle: Leaf rect=[20,20,80,40]", () => {
    // size_flags = 2 (SIZE_EXPAND only). `fit_child_in_rect` tests the SIZE_FILL
    // bit alone (container.cpp:103,114) — EXPAND never satisfies it, so this
    // child shrinks exactly like a plain SIZE_SHRINK_BEGIN child would, on BOTH
    // axes: fit_child_in_rect always runs both, it just looks main-axis-only in
    // BoxContainer because THAT container pre-sizes its main axis outside it.
    // MarginContainer never pre-sizes anything, so both axes hit the same branch.
    const child = leaf('Leaf', {
      customMinimumSize: { x: 80, y: 40 },
      sizeFlagsHorizontal: 2,
      sizeFlagsVertical: 2,
    });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 20, margin_top: 20, margin_right: 20, margin_bottom: 20 } },
      [child]
    );
    const rects = asMap(marginContainerLayout(n, [{ node: child, minSize: { x: 80, y: 40 } }], viewport, ctx()));
    expect(rects.get('Leaf')).toEqual({ x: 20, y: 20, w: 80, h: 40 });
  });

  it('ignores contentRect.x/y — child rects are relative to the CONTAINER, not its parent — oracle: nested Leaf rect=[10,20,84,53] regardless of the Inner MarginContainer sitting at [514,267] in ITS parent', () => {
    // Reproduces `MarginMinSizeViaCenterWrap/Inner` from the probe transcript:
    // a MarginContainer nested inside a CenterContainer solves to a non-zero
    // rect relative to ITS OWN parent (measured [514,267,124,113]), yet its
    // child's rect is still [10,20,84,53] — the margin offset alone, with no
    // trace of the 514/267. `contentRect` here plays the same role
    // `computeAnchoredRect` gives `parentRect`: only `.w`/`.h` matter, exactly
    // as `controlRectSolver.ts`'s `ContainerLayoutFn` doc promises ("relative
    // to the CONTAINER's top-left, not the content rect's").
    const child = leaf('Leaf', { customMinimumSize: { x: 84, y: 53 } });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 10, margin_top: 20, margin_right: 30, margin_bottom: 40 } },
      [child]
    );
    const nestedContentRect = { x: 514, y: 267, w: 124, h: 113 };
    const rects = asMap(marginContainerLayout(n, [{ node: child, minSize: { x: 84, y: 53 } }], nestedContentRect, ctx()));
    expect(rects.get('Leaf')).toEqual({ x: 10, y: 20, w: 84, h: 53 });
  });

  // `int w = ...; int h = ...` (`margin_container.cpp`) narrows the PADDED
  // result, after the margins come off — not the incoming rect. A container
  // sized from a text minimum is fractional, so the two differ in practice.
  it('narrows the padded box, not the rect it came from', () => {
    const child = leaf('Leaf', { customMinimumSize: { x: 0, y: 0 } });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 5, margin_top: 5, margin_right: 5, margin_bottom: 5 } },
      [child]
    );
    // 100.6 - 5 - 5 = 90.6 -> 90. Narrowing the rect first would give 90 too,
    // so the height picks a fraction that survives the margins: 60.4 - 10 = 50.4.
    const rects = asMap(
      marginContainerLayout(n, [{ node: child, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 100.6, h: 60.4 }, ctx())
    );
    expect(rects.get('Leaf')).toEqual({ x: 5, y: 5, w: 90, h: 50 });
  });

  it('omits an invisible child from the solved rects (margin_container.cpp:99-102, as_sortable_control default VISIBLE_IN_TREE)', () => {
    const child = leaf('Hidden', { customMinimumSize: { x: 10, y: 10 }, visible: false });
    const n = container(
      'M',
      { themeOverrideConstants: { margin_left: 5, margin_top: 5, margin_right: 5, margin_bottom: 5 } },
      [child]
    );
    const rects = asMap(marginContainerLayout(n, [{ node: child, minSize: { x: 10, y: 10 } }], viewport, ctx()));
    expect(rects.has('Hidden')).toBe(false);
  });
});
