/**
 * `graphNodeMinimumSize`/`graphNodeLayout` vs `scene/gui/graph_node.cpp`
 * (Godot 4.6.3). Every scenario uses `title: ''` (or omits it) so the
 * titlebar band floors to `fontHeightPx` alone — the SAME hand-derived
 * OpenSans_SemiBold constant `label/nativeSolver.test.ts` already
 * establishes: at font size 16 (scale 1), ascentPx=18, descentPx=5,
 * `get_line_height()` with no shaped lines = 23 (`label.cpp:125-134`, no
 * `line_spacing` folded in). Children are synthetic `customMinimumSize`
 * Controls, never Labels, so a text-shaping regression and a `_resort`
 * regression can never present as the same test failure.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutResult, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { graphNodeDrawRows, graphNodeLayout, graphNodeMinimumSize } from './nativeSolver';
import { defaultGraphNodeSlot } from './parser';
import type { GraphNodeProperties } from './types';

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

function hiddenLeaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return { ...leaf(name, props), hidden: true };
}

/** A Control the walker promoted past a Node2D — a grandchild, so no slot of its own. */
function promotedLeaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...leaf(name, props),
    skippedAncestors: {
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      visible: true,
      modulate: { r: 1, g: 1, b: 1, a: 1 },
    },
  };
}

function graphNode(
  name: string,
  props: Partial<GraphNodeProperties>,
  children: SolveNode[],
  styleBoxes: Readonly<Record<string, StyleBoxFlatData>> = {}
): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: {
      name,
      type: 'GraphNode',
      children: [],
      properties: { name, slots: new Map(), ...props } as GraphNodeProperties,
    },
    children,
    styleBoxes,
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: (n) => (n.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  };
}

/** A fully-populated `StyleBoxFlatData` with only `contentMargin` set — for a `theme_override_styles/slot` fixture. */
function marginBox(margin: { left: number; top: number; right: number; bottom: number }): StyleBoxFlatData {
  return {
    bgColor: { r: 0, g: 0, b: 0, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin: margin,
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

describe('graphNodeMinimumSize (graph_node.cpp:977-1008)', () => {
  it('one child, empty title: titlebar floors to fontHeightPx(23) + its own 4px margins', () => {
    const child = leaf('c', { customMinimumSize: { x: 50, y: 20 } });
    const n = graphNode('N', { title: '' }, [child]);
    // width: max(1 + 4+4, 50 + 18+18) = max(9, 86) = 86
    // height: (23 + 4+4) + 20 + (12+12 panel) = 31 + 20 + 24 = 75
    expect(graphNodeMinimumSize(n, ctx())).toEqual({ x: 86, y: 75 });
  });

  it('two children add one separation (2px) between them', () => {
    const c0 = leaf('c0', { customMinimumSize: { x: 30, y: 15 } });
    const c1 = leaf('c1', { customMinimumSize: { x: 20, y: 10 } });
    const n = graphNode('N', {}, [c0, c1]);
    // height: 31 + 15 + 10 + separation(2) + panel(24) = 82
    expect(graphNodeMinimumSize(n, ctx())).toEqual({ x: 66, y: 82 });
  });

  it('a DECLARED slot with draw_stylebox floors its row by the slot StyleBox margins (graph_node.cpp:993)', () => {
    const c0 = leaf('c0', { customMinimumSize: { x: 40, y: 25 } });
    const slots = new Map([[0, { ...defaultGraphNodeSlot(), drawStylebox: true }]]);
    const n = graphNode('N', { slots }, [c0], { slot: marginBox({ left: 5, top: 3, right: 5, bottom: 3 }) });
    // width: max(9, 40+36+10) = 86; height: 31 + (25+6) + 24 = 86
    expect(graphNodeMinimumSize(n, ctx())).toEqual({ x: 86, y: 86 });
  });

  it('an UNDECLARED slot adds NOTHING, even with a real slot StyleBox override — `.has(i)` gates it (graph_node.cpp:993)', () => {
    const c0 = leaf('c0', { customMinimumSize: { x: 10, y: 10 } });
    const n = graphNode('N', {}, [c0], { slot: marginBox({ left: 100, top: 100, right: 100, bottom: 100 }) });
    // height: 31 + 10 (no slot extra) + panel(24) = 65
    expect(graphNodeMinimumSize(n, ctx())).toEqual({ x: 46, y: 65 });
  });

  it('a hidden leading child still costs its sibling one separation — `if (i > 0)` reads the RAW index (graph_node.cpp:1000)', () => {
    const hidden = hiddenLeaf('h', { customMinimumSize: { x: 999, y: 999 } });
    const visible = leaf('v', { customMinimumSize: { x: 10, y: 10 } });
    const n = graphNode('N', {}, [hidden, visible]);
    // height: 31 + 10 + separation(2, from i=1>0) + panel(24) = 67
    expect(graphNodeMinimumSize(n, ctx())).toEqual({ x: 46, y: 67 });
  });

  it('is the titlebar-only size with no children', () => {
    const n = graphNode('N', {}, []);
    expect(graphNodeMinimumSize(n, ctx())).toEqual({ x: 9, y: 55 });
  });
});

describe('graphNodeLayout (graph_node.cpp:153-293)', () => {
  it('one non-stretching, FILL child fills its row', () => {
    const child = leaf('c', { customMinimumSize: { x: 50, y: 20 } });
    const n = graphNode('N', {}, [child]);
    const rects = asMap(
      graphNodeLayout(n, [{ node: child, minSize: { x: 50, y: 20 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx())
    );
    expect(rects.get('c')).toEqual({ x: 18, y: 43, w: 164, h: 20 });
  });

  it('a SHRINK child (flags 0) shrinks to its own minimum at the row origin', () => {
    const child = leaf('c', {
      customMinimumSize: { x: 50, y: 20 },
      sizeFlagsHorizontal: 0,
      sizeFlagsVertical: 0,
    });
    const n = graphNode('N', {}, [child]);
    const rects = asMap(
      graphNodeLayout(n, [{ node: child, minSize: { x: 50, y: 20 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx())
    );
    expect(rects.get('c')).toEqual({ x: 18, y: 43, w: 50, h: 20 });
  });

  it('an EXPAND|FILL child absorbs the remaining stretch space, and the LAST stretching child snaps to the panel bottom margin', () => {
    const a = leaf('a', { customMinimumSize: { x: 10, y: 10 } });
    const b = leaf('b', { customMinimumSize: { x: 10, y: 5 }, sizeFlagsVertical: 3 /* SIZE_FILL | SIZE_EXPAND */ });
    const n = graphNode('N', {}, [a, b]);
    const rects = asMap(
      graphNodeLayout(
        n,
        [
          { node: a, minSize: { x: 10, y: 10 } },
          { node: b, minSize: { x: 10, y: 5 } },
        ],
        { x: 0, y: 0, w: 100, h: 100 },
        ctx()
      )
    );
    expect(rects.get('a')).toEqual({ x: 18, y: 43, w: 64, h: 10 });
    expect(rects.get('b')).toEqual({ x: 18, y: 55, w: 64, h: 33 });
  });

  it('a declared slot widens its row by the slot StyleBox margins and insets its x', () => {
    const child = leaf('c', { customMinimumSize: { x: 10, y: 10 } });
    const slots = new Map([[0, { ...defaultGraphNodeSlot(), drawStylebox: true }]]);
    const n = graphNode('N', { slots }, [child], { slot: marginBox({ left: 5, top: 0, right: 5, bottom: 0 }) });
    const rects = asMap(
      graphNodeLayout(n, [{ node: child, minSize: { x: 10, y: 10 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx())
    );
    // x: panel margin(18) + slot margin(5) = 23; w: (200-36) - (5+5) = 154
    expect(rects.get('c')).toEqual({ x: 23, y: 43, w: 154, h: 10 });
  });

  it('an UNDECLARED slot auto-vivifies drawStylebox=true — a real theme_override_styles/slot still insets an undeclared row (graph_node.cpp:278-279)', () => {
    const child = leaf('c', { customMinimumSize: { x: 10, y: 10 } });
    const n = graphNode('N', {}, [child], { slot: marginBox({ left: 5, top: 0, right: 5, bottom: 0 }) });
    const rects = asMap(
      graphNodeLayout(n, [{ node: child, minSize: { x: 10, y: 10 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx())
    );
    expect(rects.get('c')).toEqual({ x: 23, y: 43, w: 154, h: 10 });
  });
});

describe('graphNodeDrawRows — slot indices over `get_child(i)`', () => {
  it('numbers a promoted Control out of the slot indices, matching the floor pass', () => {
    // `GraphNode::_resort` and `get_minimum_size` index slots by the child walk
    // (`graph_node.cpp:161-210`), which casts each `get_child(i)`
    // (`container.cpp:143-155`). A promoted Control is a grandchild, so the
    // sortable child after it keeps index 1 and its own slot.
    const children = [leaf('A'), promotedLeaf('Holder/P'), leaf('B')];
    const slots = new Map([[1, { ...defaultGraphNodeSlot(), rightEnabled: true }]]);
    const n = graphNode('G', { slots }, children);
    const childRects = new Map<string, Rect2>([
      ['A', { x: 0, y: 0, w: 40, h: 10 }],
      ['B', { x: 0, y: 20, w: 40, h: 10 }],
    ]);

    const rows = graphNodeDrawRows(n, n.node.properties as GraphNodeProperties, childRects, 0, 40);
    const withPort = rows.filter((r) => r.slot.rightEnabled);
    expect(withPort.map((r) => r.rawIndex)).toEqual([1]);
    // `B`'s own centre, not `A`'s — index 1 must name `B`.
    expect(withPort[0]!.slotY).toBe(25);
  });
});
