/**
 * `centerContainerMinimumSize` and `centerContainerLayout` against Godot 4.6.3
 * (`scene/gui/center_container.cpp`, `scene/gui/container.cpp`), each rect measured in a 1152×648
 * `SubViewport` with `get_rect()` and `get_combined_minimum_size()`. Children are
 * `custom_minimum_size` Controls, not Labels, so a font-metric regression cannot show as a layout one.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { CenterContainerProperties } from './types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, ContainerLayoutResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { centerContainerMinimumSize, centerContainerLayout } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

/** The `rects` half of `centerContainerLayout`'s `ContainerLayoutResult`. */
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

function container(name: string, props: Partial<CenterContainerProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'CenterContainer',
      children: [],
      properties: { name, ...props } as CenterContainerProperties,
    },
    children,
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: (n) => (n.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  };
}

describe('centerContainerMinimumSize', () => {
  it('takes the componentwise max of every visible child (center_container.cpp:37-48)', () => {
    const a = leaf('A', { customMinimumSize: { x: 60, y: 40 } });
    const b = leaf('B', { customMinimumSize: { x: 200, y: 20 } });
    const n = container('C', {}, [a, b]);
    // oracle: CenterMultiChildren min=[200,40]
    expect(centerContainerMinimumSize(n, ctx())).toEqual({ x: 200, y: 40 });
  });

  it('returns (0, 0) when use_top_left is set, regardless of children (center_container.cpp:34-36)', () => {
    const child = leaf('Leaf', { customMinimumSize: { x: 500, y: 500 } });
    const n = container('C', { useTopLeft: true }, [child]);
    expect(centerContainerMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('skips an invisible child (center_container.cpp:39, SortableVisibilityMode::VISIBLE)', () => {
    const visible = leaf('Visible', { customMinimumSize: { x: 10, y: 10 } });
    const hidden = leaf('Hidden', { customMinimumSize: { x: 999, y: 999 }, visible: false });
    const n = container('C', {}, [visible, hidden]);
    expect(centerContainerMinimumSize(n, ctx())).toEqual({ x: 10, y: 10 });
  });
});

describe('centerContainerLayout', () => {
  const viewport = { x: 0, y: 0, w: 1152, h: 648 };

  it('centres each child independently on its OWN minimum size, ignoring FILL/EXPAND flags entirely — oracle: Leaf rect=[476,274,200,100]', () => {
    // size_flags = 3 (FILL|EXPAND) on both axes. `fit_child_in_rect` receives
    // `Rect2(ofs, minsize)` (center_container.cpp:83-84), so FILL's `r.size.x = p_rect.size.x`
    // is a no-op: the child never grows to fill the container.
    const child = leaf('Leaf', {
      customMinimumSize: { x: 200, y: 100 },
      sizeFlagsHorizontal: 3,
      sizeFlagsVertical: 3,
    });
    const n = container('C', {}, [child]);
    const rects = asMap(centerContainerLayout(n, [{ node: child, minSize: { x: 200, y: 100 } }], viewport, ctx()));
    expect(rects.get('Leaf')).toEqual({ x: 476, y: 274, w: 200, h: 100 });
  });

  it('floors the halved remainder for an odd minimum size — oracle: Leaf rect=[525,293,101,61]', () => {
    const child = leaf('Leaf', { customMinimumSize: { x: 101, y: 61 } });
    const n = container('C', {}, [child]);
    const rects = asMap(centerContainerLayout(n, [{ node: child, minSize: { x: 101, y: 61 } }], viewport, ctx()));
    // floor((1152-101)/2) = floor(525.5) = 525; floor((648-61)/2) = floor(293.5) = 293.
    expect(rects.get('Leaf')).toEqual({ x: 525, y: 293, w: 101, h: 61 });
  });

  it('use_top_left floors a NEGATIVE half-size, which truncation would get wrong — oracle: Leaf rect=[-51,-31,101,61]', () => {
    // `ofs = (-minsize * 0.5).floor()` (center_container.cpp:83): an odd minimum gives a
    // negative .5, where floor(-50.5) = -51 and Math.trunc(-50.5) = -50. The centred branch's
    // `size - minsize` is never negative, since an ancestor is never smaller than a
    // descendant's combined minimum, so only this branch can tell floor from truncation.
    const child = leaf('Leaf', { customMinimumSize: { x: 101, y: 61 } });
    const n = container('C', { useTopLeft: true }, [child]);
    const rects = asMap(centerContainerLayout(n, [{ node: child, minSize: { x: 101, y: 61 } }], viewport, ctx()));
    expect(rects.get('Leaf')).toEqual({ x: -51, y: -31, w: 101, h: 61 });
  });

  it('ignores contentRect.x/y — child rects are relative to the CONTAINER, not its parent', () => {
    // `contentRect` plays the role `computeAnchoredRect` gives `parentRect`:
    // only `.w` and `.h` matter.
    const child = leaf('Leaf', { customMinimumSize: { x: 101, y: 61 } });
    const n = container('C', {}, [child]);
    const nestedContentRect = { x: 514, y: 267, w: 1152, h: 648 };
    const rects = asMap(
      centerContainerLayout(n, [{ node: child, minSize: { x: 101, y: 61 } }], nestedContentRect, ctx())
    );
    expect(rects.get('Leaf')).toEqual({ x: 525, y: 293, w: 101, h: 61 });
  });

  it('centres two children independently — the aggregate minimum never enters positioning — oracle: LeafA=[546,304,60,40], LeafB=[476,314,200,20]', () => {
    const a = leaf('LeafA', { customMinimumSize: { x: 60, y: 40 } });
    const b = leaf('LeafB', { customMinimumSize: { x: 200, y: 20 } });
    const n = container('C', {}, [a, b]);
    const rects = asMap(
      centerContainerLayout(
        n,
        [
          { node: a, minSize: { x: 60, y: 40 } },
          { node: b, minSize: { x: 200, y: 20 } },
        ],
        viewport,
        ctx()
      )
    );
    expect(rects.get('LeafA')).toEqual({ x: 546, y: 304, w: 60, h: 40 });
    expect(rects.get('LeafB')).toEqual({ x: 476, y: 314, w: 200, h: 20 });
  });

  it('omits an invisible child from the solved rects (center_container.cpp:77-78, as_sortable_control default VISIBLE_IN_TREE)', () => {
    const child = leaf('Hidden', { customMinimumSize: { x: 10, y: 10 }, visible: false });
    const n = container('C', {}, [child]);
    const rects = asMap(centerContainerLayout(n, [{ node: child, minSize: { x: 10, y: 10 } }], viewport, ctx()));
    expect(rects.has('Hidden')).toBe(false);
  });
});

describe('centerContainerLayout under RTL', () => {
  it('places a child exactly where LTR does — the fitted rect IS its minimum, so every RTL term is zero (container.cpp:99,109)', () => {
    const child = leaf('C', { customMinimumSize: { x: 40, y: 20 }, sizeFlagsHorizontal: 0 });
    const entries = [{ node: child, minSize: { x: 40, y: 20 } }];
    const contentRect = { x: 0, y: 0, w: 100, h: 50 };
    const ltr = asMap(centerContainerLayout(container('C0', {}, [child]), entries, contentRect, ctx()));
    const rtl = asMap(
      centerContainerLayout({ ...container('C0', {}, [child]), rtl: true }, entries, contentRect, ctx())
    );
    // `Point2 ofs = ((size - minsize) / 2.0).floor()` = (30, 15).
    expect(ltr.get('C')).toEqual({ x: 30, y: 15, w: 40, h: 20 });
    expect(rtl.get('C')).toEqual(ltr.get('C'));
  });
});
