/**
 * `minimap.ts` versus `GraphEditMinimap` (`scene/gui/graph_edit.cpp:76-215`) and
 * the two GraphEdit members that place it (`set_minimap_size` `:2770-2780`,
 * `_update_scrollbars` `:463-510`). Each expected number is Godot's arithmetic
 * worked by hand, never read back off this module.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import {
  GRAPH_EDIT_MINIMAP_DEFAULT_OPACITY,
  graphEditElements,
  graphScrollBounds,
  isMinimapEnabled,
  minimapCameraRect,
  minimapConvertFromGraph,
  minimapNodeRect,
  minimapOpacity,
  minimapRect,
  minimapTransform,
} from './minimap';
import type { GraphEditProperties } from './types';

function props(p: Partial<GraphEditProperties> = {}): GraphEditProperties {
  return { name: 'G', connections: [], ...p } as GraphEditProperties;
}

describe('isMinimapEnabled (graph_edit.cpp:2799-2810)', () => {
  it('defaults to enabled — the constructor seeds the button off the MEMBER show_grid, not the scene\'s', () => {
    // graph_edit.cpp:3311 `minimap_button->set_pressed(show_grid)` runs before
    // any property is applied, so `show_grid = false` in the file never reaches it.
    expect(isMinimapEnabled(props())).toBe(true);
    expect(isMinimapEnabled(props({ showGrid: false }))).toBe(true);
  });

  it('follows minimap_enabled when the scene sets it', () => {
    expect(isMinimapEnabled(props({ minimapEnabled: false }))).toBe(false);
    expect(isMinimapEnabled(props({ minimapEnabled: true }))).toBe(true);
  });
});

describe('minimapOpacity (graph_edit.cpp:2786-2792)', () => {
  it('is 0.65 by default — the constructor\'s own modulate alpha (graph_edit.cpp:3327)', () => {
    expect(minimapOpacity(props())).toBe(GRAPH_EDIT_MINIMAP_DEFAULT_OPACITY);
    expect(GRAPH_EDIT_MINIMAP_DEFAULT_OPACITY).toBe(0.65);
  });

  it('takes the scene value verbatim — set_minimap_opacity clamps nothing', () => {
    expect(minimapOpacity(props({ minimapOpacity: 0.4 }))).toBe(0.4);
  });
});

describe('minimapRect (graph_edit.cpp:2770-2780)', () => {
  it('anchors bottom-right, inset by MINIMAP_OFFSET, at the default 240x160', () => {
    // PRESET_BOTTOM_RIGHT with offsets (-240-12, -160-12, -12, -12) against a
    // 400x320 parent: left = 400 - 252, top = 320 - 172.
    expect(minimapRect({ x: 400, y: 320 }, props())).toEqual({ x: 148, y: 148, w: 240, h: 160 });
  });

  it('floors each axis at the minimap\'s own custom_minimum_size of 50 (graph_edit.cpp:3332)', () => {
    // `set_size(30, 200)` is raised to (50, 200) by Control::set_size
    // (control.cpp:1496-1503) before the offsets are read back (:2772).
    expect(minimapRect({ x: 400, y: 320 }, props({ minimapSize: { x: 30, y: 200 } }))).toEqual({
      x: 338,
      y: 108,
      w: 50,
      h: 200,
    });
  });
});

describe('graphScrollBounds (graph_edit.cpp:472-493)', () => {
  it('merges each element rect into a DEFAULT Rect2, so the graph origin is always inside', () => {
    // Rect2().merge(Rect2(40,56,120,64)) = Rect2(0,0,160,120) (rect2.h:165-180),
    // then position -= size, size += size*2 with size = (400,320).
    const bounds = graphScrollBounds(
      [{ positionOffset: { x: 40, y: 56 }, size: { x: 120, y: 64 } }],
      1,
      { x: 400, y: 320 }
    );
    expect(bounds.min).toEqual({ x: -400, y: -320 });
    expect(bounds.max).toEqual({ x: 560, y: 440 });
  });

  it('scales each element rect by zoom before merging', () => {
    // Rect2(80,112,240,128) at zoom 2 -> merged (0,0,320,240); ±size (400,320).
    const bounds = graphScrollBounds(
      [{ positionOffset: { x: 40, y: 56 }, size: { x: 120, y: 64 } }],
      2,
      { x: 400, y: 320 }
    );
    expect(bounds.min).toEqual({ x: -400, y: -320 });
    expect(bounds.max).toEqual({ x: 720, y: 560 });
  });

  it('still spans ±size with no elements at all', () => {
    const bounds = graphScrollBounds([], 1, { x: 400, y: 320 });
    expect(bounds.min).toEqual({ x: -400, y: -320 });
    expect(bounds.max).toEqual({ x: 400, y: 320 });
  });
});

describe('minimapTransform (GraphEditMinimap::update_minimap, graph_edit.cpp:76-101)', () => {
  const bounds = { min: { x: -400, y: -320 }, max: { x: 560, y: 440 } };
  const t = minimapTransform({ x: 240, y: 160 }, bounds);

  it('renders into the minimap rect less 2x MINIMAP_PADDING', () => {
    expect(t.renderSize).toEqual({ x: 230, y: 150 });
  });

  it('letterboxes on the axis the graph is narrower in, and centres with it', () => {
    // graph_size (960,760); target_ratio 230/150; graph_ratio 960/760 = 1.2632
    // is not greater, so proportions = (760 * 230/150, 760) = (1165.3333, 760)
    // and graph_padding.x = (1165.3333 - 960)/2 = 102.6667.
    expect(t.graphProportions.x).toBeCloseTo(1165.3333, 3);
    expect(t.graphProportions.y).toBe(760);
    // minimap_offset = padding + convert(graph_padding)
    //               = 5 + 102.6667 * 230 / 1165.3333 = 25.26316.
    expect(t.minimapOffset.x).toBeCloseTo(25.26316, 4);
    expect(t.minimapOffset.y).toBe(5);
  });

  it('converts a graph delta into minimap pixels through render_size / proportions', () => {
    // 440 * 230 / 1165.3333 = 86.8421; 376 * 150 / 760 = 74.2105.
    const p = minimapConvertFromGraph(t, { x: 440, y: 376 });
    expect(p.x).toBeCloseTo(86.8421, 3);
    expect(p.y).toBeCloseTo(74.2105, 3);
  });

  it('places one node rect at convert(position_offset * zoom - graph_offset) + minimap_offset', () => {
    const r = minimapNodeRect(t, bounds, { positionOffset: { x: 40, y: 56 }, size: { x: 120, y: 64 } }, 1);
    expect(r.x).toBeCloseTo(112.10526, 4);
    expect(r.y).toBeCloseTo(79.2105, 3);
    // convert(120,64) = (120*230/1165.3333, 64*150/760).
    expect(r.w).toBeCloseTo(23.6842, 3);
    expect(r.h).toBeCloseTo(12.6316, 3);
  });

  it('centres the camera rect on scroll_offset + size/2, sized by the GraphEdit rect', () => {
    // camera_position (400,320), camera_size (400,320):
    // centre = convert(600,480) + offset = (118.42105 + 25.26316, 94.7368 + 5)
    // viewport = convert(400,320) = (78.9474, 63.1579); pos = centre - viewport/2.
    const r = minimapCameraRect(t, bounds, { x: 0, y: 0 }, { x: 400, y: 320 });
    expect(r.x).toBeCloseTo(104.21053, 4);
    expect(r.y).toBeCloseTo(68.1579, 3);
    expect(r.w).toBeCloseTo(78.9474, 3);
    expect(r.h).toBeCloseTo(63.1579, 3);
  });

  it('floors a zero-extent graph axis at 1 (graph_edit.cpp:121-128)', () => {
    const degenerate = minimapTransform({ x: 240, y: 160 }, { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } });
    expect(Number.isFinite(degenerate.graphProportions.x)).toBe(true);
    expect(Number.isFinite(degenerate.graphProportions.y)).toBe(true);
  });
});

describe('graphEditElements', () => {
  const theme = nativeTheme(1);

  function element(name: string, type: string, props: Record<string, unknown>): SolveNode {
    return {
      ...emptySolveNode(),
      path: name,
      node: { name, type, children: [], properties: { name, ...props } as never },
    };
  }

  function graphEdit(children: SolveNode[]): SolveNode {
    return {
      ...emptySolveNode(),
      path: 'G',
      node: { name: 'G', type: 'GraphEdit', children: [], properties: { name: 'G', connections: [] } as never },
      children,
    };
  }

  const rects: ReadonlyMap<string, Rect2> = new Map([
    ['Frame', { x: 0, y: 0, w: 200, h: 100 }],
    ['A', { x: 0, y: 0, w: 120, h: 64 }],
    ['B', { x: 0, y: 0, w: 120, h: 64 }],
  ]);

  it('draws frames before nodes, each from the LAST child backwards (graph_edit.cpp:1821,1844)', () => {
    const view = graphEditElements(
      graphEdit([
        element('A', 'GraphNode', { positionOffset: { x: 0, y: 0 } }),
        element('Frame', 'GraphFrame', { positionOffset: { x: 0, y: 0 } }),
        element('B', 'GraphNode', { positionOffset: { x: 0, y: 0 } }),
      ]),
      rects,
      1,
      { x: 400, y: 320 },
      theme
    );
    expect(view.minimapElements.map((e) => e.key)).toEqual(['Frame', 'B', 'A']);
  });

  it('counts a hidden element in the scroll bounds but never draws it in the minimap', () => {
    // `_update_scrollbars` (:475-487) has no visibility test at all, while both
    // `_minimap_draw` loops open with `!…->is_visible()` (:1823,1846).
    const view = graphEditElements(
      graphEdit([
        element('A', 'GraphNode', { positionOffset: { x: 0, y: 0 } }),
        element('B', 'GraphNode', { positionOffset: { x: 500, y: 0 }, visible: false }),
      ]),
      rects,
      1,
      { x: 400, y: 320 },
      theme
    );
    expect(view.minimapElements.map((e) => e.key)).toEqual(['A']);
    // Rect2().merge(A) is (0,0,120,64) merged with B at (500,0,120,64) -> width 620.
    expect(view.bounds.max.x).toBe(620 + 400);
  });
});
