/**
 * `graphEditLayout` versus `GraphEdit::_update_scroll_offset`
 * (`scene/gui/graph_edit.cpp:435-462`, position half only: see the
 * module's own doc for the unreachable `set_scale(zoom, zoom)` half).
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { GraphElementProperties } from '../graphelement/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutResult, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { graphEditLayout } from './nativeSolver';
import type { GraphEditProperties } from './types';

function asMap(result: ReadonlyMap<string, Rect2> | ContainerLayoutResult): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

function graphNodeChild(name: string, props: Partial<GraphElementProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'GraphNode', children: [], properties: { name, ...props } as GraphElementProperties },
  };
}

function controlChild(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties },
  };
}

function graphEdit(name: string, props: Partial<GraphEditProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'GraphEdit', children: [], properties: { name, ...props } as GraphEditProperties },
    children,
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('graphEditLayout (graph_edit.cpp:435-462, position only)', () => {
  it('places a GraphElement child at position_offset - scroll_offset, at zoom 1, natural size from its own offsets', () => {
    const child = graphNodeChild('n', {
      positionOffset: { x: 40, y: 60 },
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 100,
      offsetBottom: 50,
    });
    const n = graphEdit('G', { scrollOffset: { x: 10, y: 5 } }, [child]);
    const rects = asMap(graphEditLayout(n, [{ node: child, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 800, h: 600 }, ctx()));
    expect(rects.get('n')).toEqual({ x: 30, y: 55, w: 100, h: 50 });
  });

  it('scales the position_offset contribution by zoom, but never the drawn size', () => {
    const child = graphNodeChild('n', {
      positionOffset: { x: 40, y: 60 },
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 100,
      offsetBottom: 50,
    });
    const n = graphEdit('G', { zoom: 2, scrollOffset: { x: 0, y: 0 } }, [child]);
    const rects = asMap(graphEditLayout(n, [{ node: child, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 800, h: 600 }, ctx()));
    expect(rects.get('n')).toEqual({ x: 80, y: 120, w: 100, h: 50 });
  });

  it('defaults position_offset to (0, 0) when absent', () => {
    const child = graphNodeChild('n', { offsetLeft: 0, offsetTop: 0, offsetRight: 10, offsetBottom: 10 });
    const n = graphEdit('G', {}, [child]);
    const rects = asMap(graphEditLayout(n, [{ node: child, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 800, h: 600 }, ctx()));
    expect(rects.get('n')).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it('a non-GraphElement child resolves as an ordinary free/anchored Control, untouched by position_offset', () => {
    const child = controlChild('c', { offsetLeft: 5, offsetTop: 5, offsetRight: 25, offsetBottom: 15 });
    const n = graphEdit('G', {}, [child]);
    const rects = asMap(graphEditLayout(n, [{ node: child, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 800, h: 600 }, ctx()));
    expect(rects.get('c')).toEqual({ x: 5, y: 5, w: 20, h: 10 });
  });
});
