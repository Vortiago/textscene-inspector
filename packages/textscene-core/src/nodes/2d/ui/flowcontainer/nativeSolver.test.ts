/**
 * `flowContainerMinimumSize`/`flowContainerLayout` vs Godot 4.6.3
 * (`scene/gui/flow_container.cpp`, `scene/gui/container.cpp`). Every
 * expected rect below is hand-derived from that source, transcribing
 * `_resort`'s two passes exactly (cited beside each assertion). Children are
 * synthetic `custom_minimum_size` Controls, never Labels, so a font-metric
 * regression and a `_resort` regression can never present as the same test
 * failure. `h_separation`/`v_separation` are set via
 * `theme_override_constants` on the flow node itself so every test's
 * arithmetic is independent of the theme's own scale.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { FlowContainerProperties } from './types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { flowContainerMinimumSize, flowContainerLayout } from './nativeSolver';
import { solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function leaf(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
  };
}

function flow(
  type: 'FlowContainer' | 'HFlowContainer' | 'VFlowContainer',
  props: Partial<FlowContainerProperties> & { hSep?: number; vSep?: number },
  children: SolveNode[]
): SolveNode {
  const { hSep, vSep, ...rest } = props;
  const themeOverrideConstants: Record<string, number> = {};
  if (hSep !== undefined) themeOverrideConstants.h_separation = hSep;
  if (vSep !== undefined) themeOverrideConstants.v_separation = vSep;
  return {
    ...solveNode(),
    path: 'F',
    node: {
      name: 'F',
      type,
      children: [],
      properties: { name: 'F', ...rest, themeOverrideConstants } as FlowContainerProperties,
    },
    children,
    // A local theme_override_constants/* now reaches `separationOf` through
    // `n.constants` (the walker folds it in unconditionally), not props.
    constants: themeOverrideConstants,
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

function childEntries(children: SolveNode[]): { node: SolveNode; minSize: { x: number; y: number } }[] {
  return children.map((node) => ({
    node,
    minSize: (node.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  }));
}

/**
 * Solves `flowNode` and its children through the real solver core (the same
 * two-pass `solveControlTree` production uses), so a test can assert the
 * `SizeDependentMinimum` closure end to end rather than a slice-local
 * simulation of it. Explicit offsets pin the flow container's OWN rect,
 * exactly like `gridcontainer/nativeSolver.test.ts`'s `solveViaGrid`.
 */
function solveViaFlow(flowNode: SolveNode, rect: { x: number; y: number; w: number; h: number }) {
  const p = flowNode.node.properties as FlowContainerProperties;
  (flowNode.node as { properties: unknown }).properties = {
    ...p,
    offsetLeft: rect.x,
    offsetTop: rect.y,
    offsetRight: rect.x + rect.w,
    offsetBottom: rect.y + rect.h,
  };
  const solved = solveControlTree([flowNode], { x: 0, y: 0, w: 1152, h: 648 }, ctx());
  return solved;
}

describe('flowContainerMinimumSize', () => {
  it('is (0, 0) with no sortable children (the assigning loop never runs, flow_container.cpp:270-286)', () => {
    expect(flowContainerMinimumSize(flow('FlowContainer', {}, []), ctx())).toEqual({ x: 0, y: 0 });
  });

  it('skips a hidden child (flow_container.cpp:271, as_sortable_control VISIBLE)', () => {
    const hidden = leaf('c1', { customMinimumSize: { x: 90, y: 90 }, visible: false });
    expect(flowContainerMinimumSize(flow('FlowContainer', {}, [hidden]), ctx())).toEqual({ x: 0, y: 0 });
  });

  it('horizontal: main axis (width) is the max child width, cross axis (height) is cached_size (flow_container.cpp:278-285)', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 30, y: 10 } }),
      leaf('c2', { customMinimumSize: { x: 30, y: 10 } }),
      leaf('c3', { customMinimumSize: { x: 30, y: 10 } }),
    ];
    // First pass has no tentative rect: current_container_size substitutes
    // Infinity (module doc) -> never wraps -> single line.
    // cached_size = ofs.y(0) + line_height(max child height = 10) = 10.
    const result = flowContainerMinimumSize(flow('FlowContainer', {}, children), ctx());
    expect(result).toEqual({ x: 30, y: 10 });
  });

  it('vertical: main axis (height) is the max child height, cross axis (width) is cached_size', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 10, y: 30 } }),
      leaf('c2', { customMinimumSize: { x: 10, y: 30 } }),
    ];
    const result = flowContainerMinimumSize(flow('VFlowContainer', {}, children), ctx());
    expect(result).toEqual({ x: 10, y: 30 });
  });

  it('HFlowContainer/VFlowContainer resolve orientation from the node TYPE, ignoring a stray `vertical` property (flow_container.h:99-113)', () => {
    const children = [leaf('c1', { customMinimumSize: { x: 30, y: 10 } })];
    // `vertical: true` on an HFlowContainer is a property Godot's own editor
    // could never write (it is hidden/USAGE_NONE); the solver must still
    // treat it as horizontal.
    const result = flowContainerMinimumSize(flow('HFlowContainer', { vertical: true }, children), ctx());
    expect(result).toEqual({ x: 30, y: 10 });
  });

  it('two-pass closure: the second pass wraps against the container’s OWN real resolved width (flow_container.cpp:61)', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c2', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c3', { customMinimumSize: { x: 20, y: 10 } }),
    ];
    const f = flow('FlowContainer', { hSep: 10, vSep: 5 }, children);
    const solved = solveViaFlow(f, { x: 0, y: 0, w: 55, h: 200 });
    // Wrapped against width 55 (see flowContainerLayout's "wraps into two
    // lines" test for the full per-child trace): line0 = {c1,c2} length 50,
    // line1 = {c3} length 20. cached_size = (10 + 5) + 10 = 25.
    expect(solved.get('F')?.minSize).toEqual({ x: 20, y: 25 });
  });
});

describe('flowContainerLayout', () => {
  it('single line, no wrap: children flow left-to-right with h_separation between them (flow_container.cpp:130-261)', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c2', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c3', { customMinimumSize: { x: 20, y: 10 } }),
    ];
    const f = flow('FlowContainer', { hSep: 10, vSep: 5 }, children);
    const rects = flowContainerLayout(f, childEntries(children), { x: 0, y: 0, w: 100, h: 40 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    expect(rects.get('c1')).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(rects.get('c2')).toEqual({ x: 30, y: 0, w: 20, h: 10 });
    expect(rects.get('c3')).toEqual({ x: 60, y: 0, w: 20, h: 10 });
  });

  it('wraps into two lines when the third child would overflow the width (flow_container.cpp:96-117)', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c2', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c3', { customMinimumSize: { x: 20, y: 10 } }),
    ];
    const f = flow('FlowContainer', { hSep: 10, vSep: 5 }, children);
    const rects = flowContainerLayout(f, childEntries(children), { x: 0, y: 0, w: 55, h: 40 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    // c1,c2 fit line0 (0+20=20, +10+20=50 <= 55); c3 would need 50+10+20=80 > 55 -> wraps.
    expect(rects.get('c1')).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(rects.get('c2')).toEqual({ x: 30, y: 0, w: 20, h: 10 });
    // New line at y = line0.min_line_height(10) + v_separation(5) = 15; last_wrap_alignment
    // defaults to INHERIT, which behaves like BEGIN (no offset).
    expect(rects.get('c3')).toEqual({ x: 0, y: 15, w: 20, h: 10 });
  });

  it('a single child wider than the container alone pushes an empty leading line (flow_container.cpp:96-101, only the FIRST child can do this)', () => {
    const child = leaf('c1', { customMinimumSize: { x: 20, y: 10 } });
    const f = flow('FlowContainer', { hSep: 10, vSep: 5 }, [child]);
    const rects = flowContainerLayout(f, childEntries([child]), { x: 0, y: 0, w: 10, h: 40 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    // line0 is empty (child_count 0, height 0); the child lands in line1,
    // shifted down by line0's own (zero-height) + v_separation gap.
    expect(rects.get('c1')).toEqual({ x: 0, y: 5, w: 20, h: 10 });
  });

  it('centers an EXPAND child’s share of leftover main-axis space, truncated toward zero (flow_container.cpp:228-231)', () => {
    const a = leaf('a', { customMinimumSize: { x: 40, y: 10 }, sizeFlagsHorizontal: 3 }); // FILL|EXPAND
    const b = leaf('b', { customMinimumSize: { x: 40, y: 10 }, sizeFlagsHorizontal: 3 });
    (b.node.properties as ControlProperties).sizeFlagsStretchRatio = 2;
    const f = flow('FlowContainer', { hSep: 0, vSep: 0 }, [a, b]);
    // line_length = 40 + 40 = 80; stretch_avail = 100 - 80 = 20; ratio total = 1 + 2 = 3.
    // stretch_a = trunc(20 * 1 / 3) = 6; stretch_b = trunc(20 * 2 / 3) = 13.
    const rects = flowContainerLayout(f, childEntries([a, b]), { x: 0, y: 0, w: 100, h: 40 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    expect(rects.get('a')).toEqual({ x: 0, y: 0, w: 46, h: 10 });
    expect(rects.get('b')).toEqual({ x: 46, y: 0, w: 53, h: 10 });
  });

  it('last_wrap_alignment CENTER, trailing line tighter than the one before it: negative half truncates toward zero, not down (flow_container.cpp:175-185)', () => {
    // line0: one child width 14 (length 14, stretch_avail 20-14=6), then wraps
    // (14+16=30 > 20). line1 (last): 16+1=17 (stretch_avail 20-17=3); NOT
    // filled since ofs(17) + last child width(1) = 18 <= 20.
    const c0 = leaf('c0', { customMinimumSize: { x: 14, y: 10 } });
    const c1 = leaf('c1', { customMinimumSize: { x: 16, y: 10 } });
    const c2 = leaf('c2', { customMinimumSize: { x: 1, y: 10 } });
    const f = flow('FlowContainer', { hSep: 0, vSep: 0, lastWrapAlignment: 2 }, [c0, c1, c2]); // LAST_WRAP_ALIGNMENT_CENTER
    const rects = flowContainerLayout(
      f,
      childEntries([c0, c1, c2]),
      { x: 0, y: 0, w: 20, h: 40 },
      ctx()
    ) as ReadonlyMap<string, Rect2>;
    expect(rects.get('c0')).toEqual({ x: 0, y: 0, w: 14, h: 10 });
    // alignment_ofs = trunc((3 - 6) * 0.5) = trunc(-1.5) = -1 (toward zero, not -2).
    expect(rects.get('c1')).toEqual({ x: -1, y: 10, w: 16, h: 10 });
    expect(rects.get('c2')).toEqual({ x: 15, y: 10, w: 1, h: 10 });
  });

  it('ALIGNMENT_CENTER centers a single-line, non-expanding row (flow_container.cpp:175-184)', () => {
    const c0 = leaf('c0', { customMinimumSize: { x: 20, y: 10 } });
    const f = flow('FlowContainer', { hSep: 0, vSep: 0, alignment: 1 }, [c0]); // ALIGNMENT_CENTER
    const rects = flowContainerLayout(f, childEntries([c0]), { x: 0, y: 0, w: 100, h: 40 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    // Single (first, filled-by-definition) line: alignment_ofs = stretch_avail * 0.5 = (100-20)*0.5 = 40.
    expect(rects.get('c0')).toEqual({ x: 40, y: 0, w: 20, h: 10 });
  });

  it('ALIGNMENT_END pushes a single-line, non-expanding row to the far edge (flow_container.cpp:186-196)', () => {
    const c0 = leaf('c0', { customMinimumSize: { x: 20, y: 10 } });
    const f = flow('FlowContainer', { hSep: 0, vSep: 0, alignment: 2 }, [c0]); // ALIGNMENT_END
    const rects = flowContainerLayout(f, childEntries([c0]), { x: 0, y: 0, w: 100, h: 40 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    expect(rects.get('c0')).toEqual({ x: 80, y: 0, w: 20, h: 10 });
  });

  it('reverse_fill flips the CROSS axis position — Y for horizontal (flow_container.cpp:245-247)', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c2', { customMinimumSize: { x: 20, y: 10 } }),
      leaf('c3', { customMinimumSize: { x: 20, y: 10 } }),
    ];
    const f = flow('FlowContainer', { hSep: 10, vSep: 5, reverseFill: true }, children);
    const rects = flowContainerLayout(f, childEntries(children), { x: 0, y: 0, w: 55, h: 100 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    // Non-reversed y's were 0, 0, 15 (see the wrap test above); reversed: h - y - childH.
    expect(rects.get('c1')).toEqual({ x: 0, y: 90, w: 20, h: 10 });
    expect(rects.get('c2')).toEqual({ x: 30, y: 90, w: 20, h: 10 });
    expect(rects.get('c3')).toEqual({ x: 0, y: 75, w: 20, h: 10 });
  });

  it('reverse_fill flips the CROSS axis position — X for vertical, with rtl hardcoded false (flow_container.cpp:248-250)', () => {
    const children = [
      leaf('c1', { customMinimumSize: { x: 10, y: 20 } }),
      leaf('c2', { customMinimumSize: { x: 10, y: 20 } }),
    ];
    const f = flow('VFlowContainer', { hSep: 0, vSep: 5, reverseFill: true }, children);
    const rects = flowContainerLayout(f, childEntries(children), { x: 0, y: 0, w: 50, h: 100 }, ctx()) as ReadonlyMap<
      string,
      Rect2
    >;
    // Single column (no wrap): x stays flipped the same for both (contentRect.w - 0 - column_width).
    expect(rects.get('c1')).toEqual({ x: 40, y: 0, w: 10, h: 20 });
    expect(rects.get('c2')).toEqual({ x: 40, y: 25, w: 10, h: 20 });
  });

  it('is empty with no sortable children', () => {
    const f = flow('FlowContainer', {}, []);
    const rects = flowContainerLayout(f, [], { x: 0, y: 0, w: 100, h: 40 }, ctx()) as ReadonlyMap<string, Rect2>;
    expect(rects.size).toBe(0);
  });
});
