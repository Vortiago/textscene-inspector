/**
 * `graphElementMinimumSize`/`graphElementLayout` versus
 * `scene/gui/graph_element.cpp` (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutResult, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { graphElementLayout, graphElementMinimumSize } from './nativeSolver';

function asMap(result: ReadonlyMap<string, Rect2> | ContainerLayoutResult): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

function leaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: (n) => (n.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  };
}

describe('graphElementMinimumSize', () => {
  it('is the max, per axis, of every child combined minimum size', () => {
    // graph_element.cpp:59-73.
    const a = leaf('a', { customMinimumSize: { x: 40, y: 10 } });
    const b = leaf('b', { customMinimumSize: { x: 20, y: 30 } });
    const n = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties }, children: [a, b] };
    expect(graphElementMinimumSize(n, ctx())).toEqual({ x: 40, y: 30 });
  });

  it('is (0, 0) with no children', () => {
    const n = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties } };
    expect(graphElementMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('counts a HIDDEN child — SortableVisibilityMode::IGNORE (graph_element.cpp:62)', () => {
    const hiddenChild: SolveNode = { ...leaf('h', { customMinimumSize: { x: 100, y: 5 } }), hidden: true };
    const n = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties }, children: [hiddenChild] };
    expect(graphElementMinimumSize(n, ctx())).toEqual({ x: 100, y: 5 });
  });
});

describe('graphElementLayout', () => {
  it('fits every visible child into the full own rect', () => {
    // graph_element.cpp:47-57: no chrome, no margin.
    const a = leaf('a', { customMinimumSize: { x: 10, y: 10 } });
    const contentRect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const n = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties }, children: [a] };
    const rects = asMap(graphElementLayout(n, [{ node: a, minSize: { x: 10, y: 10 } }], contentRect, ctx()));
    // Default SIZE_FILL on both axes: stretches to fill.
    expect(rects.get('a')).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('skips an invisible child — default SortableVisibilityMode::VISIBLE_IN_TREE (graph_element.cpp:51)', () => {
    const hiddenChild: SolveNode = { ...leaf('h', {}), hidden: true };
    const contentRect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const n = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties }, children: [hiddenChild] };
    const rects = asMap(graphElementLayout(n, [{ node: hiddenChild, minSize: { x: 0, y: 0 } }], contentRect, ctx()));
    expect(rects.has('h')).toBe(false);
  });

  it('shrinks a SHRINK_BEGIN child to its own minimum size at the origin', () => {
    const a = leaf('a', { sizeFlagsHorizontal: 0, sizeFlagsVertical: 0, customMinimumSize: { x: 10, y: 10 } });
    const contentRect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const n = { ...solveNode(), path: 'G', node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties }, children: [a] };
    const rects = asMap(graphElementLayout(n, [{ node: a, minSize: { x: 10, y: 10 } }], contentRect, ctx()));
    expect(rects.get('a')).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });
});

describe('graphElementLayout under RTL', () => {
  it('hands the container rtl to fit_child_in_rect (container.cpp:99,109)', () => {
    // `graph_element.cpp` calls `is_layout_rtl()` nowhere; the flag reaches a
    // child only through `Container::fit_child_in_rect`.
    const child = leaf('c', { customMinimumSize: { x: 30, y: 10 }, sizeFlagsHorizontal: 0 });
    const n = {
      ...solveNode(),
      path: 'G',
      node: { name: 'G', type: 'GraphElement', children: [], properties: {} as ControlProperties },
      children: [child],
      rtl: true,
    };
    const rects = asMap(
      graphElementLayout(n, [{ node: child, minSize: { x: 30, y: 10 } }], { x: 0, y: 0, w: 100, h: 50 }, ctx())
    );
    expect(rects.get('c')).toEqual({ x: 70, y: 0, w: 30, h: 50 });
  });
});
