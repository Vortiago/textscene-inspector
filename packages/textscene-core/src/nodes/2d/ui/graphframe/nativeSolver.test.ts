/**
 * `graphFrameMinimumSize`/`graphFrameLayout` vs `scene/gui/graph_frame.cpp`
 * (Godot 4.6.3). `title: ''` throughout, so the titlebar band floors to
 * `GRAPH_FRAME_TITLE_FONT_SIZE_PX`(22)'s own `fontHeightPx` — hand-derived
 * from the vendored OpenSans_SemiBold metrics (`unitsPerEm=2048, ascent=2189,
 * descent=600`): ascentPx = ceil(2189*22/2048) = 24, descentPx =
 * ceil(600*22/2048) = 7, `get_line_height()` (no `line_spacing` folded in) =
 * 31.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutResult, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { graphFrameLayout, graphFrameMinimumSize } from './nativeSolver';
import type { GraphFrameProperties } from './types';

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

function graphFrame(name: string, props: Partial<GraphFrameProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'GraphFrame', children: [], properties: { name, ...props } as GraphFrameProperties },
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

describe('graphFrameMinimumSize (graph_frame.cpp:324-346)', () => {
  it('one child: titlebar floors to 31 + its own 4px margins, panel adds its 18/12 margins', () => {
    const child = leaf('c', { customMinimumSize: { x: 50, y: 20 } });
    const n = graphFrame('F', { title: '' }, [child]);
    // width: max(1 + 4+4, 50 + 18+18) = max(9, 86) = 86
    // height: (31 + 4+4) + MAX(39, 20) [= 39, since 39 > 20] + panel(12+12) = 39+39+24 = 102
    expect(graphFrameMinimumSize(n, ctx())).toEqual({ x: 86, y: 102 });
  });

  it('the documented `+= MAX` fold: two children at LEAST double the running height per iteration', () => {
    const c0 = leaf('c0', { customMinimumSize: { x: 10, y: 5 } });
    const c1 = leaf('c1', { customMinimumSize: { x: 10, y: 5 } });
    const n = graphFrame('F', { title: '' }, [c0, c1]);
    // titlebar band: 39. after c0: 39 + MAX(39,5) = 78. after c1: 78 + MAX(78,5) = 156.
    // + panel(24) = 180
    expect(graphFrameMinimumSize(n, ctx())).toEqual({ x: 46, y: 180 });
  });

  it('is the titlebar-only size with no children', () => {
    const n = graphFrame('F', {}, []);
    expect(graphFrameMinimumSize(n, ctx())).toEqual({ x: 9, y: 63 });
  });
});

describe('graphFrameLayout (graph_frame.cpp:145-169)', () => {
  it('every child shares the SAME content rect — no stacking', () => {
    const a = leaf('a', { customMinimumSize: { x: 10, y: 10 } });
    const b = leaf('b', { customMinimumSize: { x: 20, y: 15 } });
    const n = graphFrame('F', { title: '' }, [a, b]);
    const rects = asMap(
      graphFrameLayout(
        n,
        [
          { node: a, minSize: { x: 10, y: 10 } },
          { node: b, minSize: { x: 20, y: 15 } },
        ],
        { x: 0, y: 0, w: 200, h: 150 },
        ctx()
      )
    );
    // content rect: x=18, y=12+39=51, w=200-36=164, h=150-24-39=87
    expect(rects.get('a')).toEqual({ x: 18, y: 51, w: 164, h: 87 });
    expect(rects.get('b')).toEqual({ x: 18, y: 51, w: 164, h: 87 });
  });

  it('a SHRINK child (flags 0) shrinks to its own minimum at the content rect origin', () => {
    const a = leaf('a', {
      customMinimumSize: { x: 10, y: 10 },
      sizeFlagsHorizontal: 0,
      sizeFlagsVertical: 0,
    });
    const n = graphFrame('F', { title: '' }, [a]);
    const rects = asMap(
      graphFrameLayout(n, [{ node: a, minSize: { x: 10, y: 10 } }], { x: 0, y: 0, w: 200, h: 150 }, ctx())
    );
    expect(rects.get('a')).toEqual({ x: 18, y: 51, w: 10, h: 10 });
  });
});

describe('graphFrameLayout under RTL', () => {
  it('hands the container rtl to fit_child_in_rect (container.cpp:99,109)', () => {
    // `graph_frame.cpp` calls `is_layout_rtl()` nowhere; the flag reaches a
    // child only through `Container::fit_child_in_rect`. The panel StyleBox is
    // `make_flat_stylebox(..., 18, 12, 18, 12, ...)` (`default_theme.cpp:830`),
    // so the content rect is x 18, width 200 - 18 - 18 = 164, and a 10-wide
    // child lands at 18 + 164 - 10.
    const a = leaf('a', { customMinimumSize: { x: 10, y: 10 }, sizeFlagsHorizontal: 0, sizeFlagsVertical: 0 });
    const n = { ...graphFrame('F', { title: '' }, [a]), rtl: true };
    const rects = asMap(
      graphFrameLayout(n, [{ node: a, minSize: { x: 10, y: 10 } }], { x: 0, y: 0, w: 200, h: 150 }, ctx())
    );
    expect(rects.get('a')).toEqual({ x: 172, y: 51, w: 10, h: 10 });
  });
});
