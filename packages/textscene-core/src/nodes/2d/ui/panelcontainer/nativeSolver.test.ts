/**
 * PanelContainer's native (WebGL canvas) container solve — ported from
 * `scene/gui/panel_container.cpp` (`PanelContainer::get_minimum_size`,
 * `PanelContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` inset) and
 * `scene/gui/container.cpp` (`Container::fit_child_in_rect`, the size-flags
 * half of placing a child inside that inset rect). Driven with synthetic
 * `custom_minimum_size` children — never Labels — so a font-metric regression
 * elsewhere could never masquerade as a layout regression here. Every
 * expected value is either the Godot source formula (cited inline) or a
 * hand-worked example from it, never re-derived the way the implementation
 * derives it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { controlSolverRegistry, type ContainerLayoutResult } from '../../../../r3f/controls/native/solverRegistry';
import type { ControlProperties } from '../control/types';
import { panelContainerLayout, panelContainerMinimumSize } from './nativeSolver';

/** `panelContainerLayout`'s `rects` half only — see `ContainerLayoutResult`'s own doc for why the union is here at all. */
function rects(
  result: ReadonlyMap<string, Rect2> | ContainerLayoutResult
): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function styleBox(contentMargin = ZERO_SIDES): StyleBoxFlatData {
  return {
    bgColor: { r: 0, g: 0, b: 0, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin,
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
  };
}

function solveNode(
  path: string,
  properties: Partial<ControlProperties> = {},
  children: SolveNode[] = [],
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const name = path.split('/').pop()!;
  const node: TscnNode = {
    name,
    type: 'Control',
    children: [],
    properties: { name, ...properties } as ControlProperties,
  };
  return { path, node, children, styleBoxes, textureSize: null };
}

function ctx() {
  return createSolveContext(nativeTheme(1));
}

describe('panelContainerMinimumSize (scene/gui/panel_container.cpp::PanelContainer::get_minimum_size)', () => {
  it('is (0,0) with no children and no panel style override (default-theme panel margins are zero)', () => {
    const n = solveNode('Panel', {}, []);
    expect(panelContainerMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it("adds the panel style's content margins to a single child's combined minimum size", () => {
    const child = solveNode('Panel/Child', { customMinimumSize: { x: 40, y: 20 } });
    const n = solveNode('Panel', {}, [child], {
      panel: styleBox({ left: 10, top: 6, right: 10, bottom: 6 }),
    });
    // get_minimum_size (panel_container.cpp:35-51): ms = max(child mins) = (40,20);
    // ms += panel_style->get_minimum_size() = (margin_left+margin_right,
    // margin_top+margin_bottom) = (20,12) (style_box.cpp:35-36).
    expect(panelContainerMinimumSize(n, ctx())).toEqual({ x: 60, y: 32 });
  });

  it('takes the per-axis MAX across multiple children, not their sum (panel_container.cpp:44 — ms.max(minsize))', () => {
    const a = solveNode('Panel/A', { customMinimumSize: { x: 100, y: 10 } });
    const b = solveNode('Panel/B', { customMinimumSize: { x: 30, y: 80 } });
    const n = solveNode('Panel', {}, [a, b], { panel: styleBox() });
    expect(panelContainerMinimumSize(n, ctx())).toEqual({ x: 100, y: 80 });
  });
});

describe("panelContainerLayout (PanelContainer::_notification's NOTIFICATION_SORT_CHILDREN)", () => {
  it("insets the content rect by the panel style's margins (ofs = style->get_offset(), size -= style->get_minimum_size())", () => {
    const child = solveNode('Panel/Child', { customMinimumSize: { x: 10, y: 10 } });
    const n = solveNode('Panel', {}, [child], {
      panel: styleBox({ left: 10, top: 6, right: 10, bottom: 6 }),
    });
    const rect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const children = [{ node: child, minSize: { x: 10, y: 10 } }];
    const out = rects(panelContainerLayout(n, children, rect, ctx()));
    // ofs = style->get_offset() = (margin_left, margin_top) = (10, 6) (style_box.cpp:88-89).
    // size = get_size() - style->get_minimum_size() = (200-20, 100-12) = (180, 88).
    // Default size flags (SIZE_FILL) take the whole content rect
    // (container.cpp:103,114 — the shrink branch never runs).
    expect(out.get('Panel/Child')).toEqual({ x: 10, y: 6, w: 180, h: 88 });
  });

  it("shrinks a non-FILL (SHRINK_BEGIN) child to its minimum size, pinned to the content rect's begin edge", () => {
    const child = solveNode('Panel/Child', {
      customMinimumSize: { x: 40, y: 20 },
      sizeFlagsHorizontal: 0,
      sizeFlagsVertical: 0,
    });
    const n = solveNode('Panel', {}, [child], { panel: styleBox() });
    const rect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const children = [{ node: child, minSize: { x: 40, y: 20 } }];
    const out = rects(panelContainerLayout(n, children, rect, ctx()));
    // container.cpp:103-112,114-122: r.size = minsize; no SHRINK_END/CENTER bit → position unchanged.
    expect(out.get('Panel/Child')).toEqual({ x: 0, y: 0, w: 40, h: 20 });
  });

  it('centres a SHRINK_CENTER child within the content rect (container.cpp:108,118 — floor((rect - min) / 2))', () => {
    const child = solveNode('Panel/Child', {
      customMinimumSize: { x: 40, y: 21 },
      sizeFlagsHorizontal: 4,
      sizeFlagsVertical: 4,
    });
    const n = solveNode('Panel', {}, [child], { panel: styleBox() });
    const rect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const children = [{ node: child, minSize: { x: 40, y: 21 } }];
    const out = rects(panelContainerLayout(n, children, rect, ctx()));
    // x = floor((200-40)/2) = 80; y = floor((100-21)/2) = floor(39.5) = 39.
    expect(out.get('Panel/Child')).toEqual({ x: 80, y: 39, w: 40, h: 21 });
  });

  it("shrinks a SHRINK_END child to its minimum size, pinned to the content rect's far edge (container.cpp:106,117)", () => {
    const child = solveNode('Panel/Child', {
      customMinimumSize: { x: 40, y: 20 },
      sizeFlagsHorizontal: 8,
      sizeFlagsVertical: 8,
    });
    const n = solveNode('Panel', {}, [child], { panel: styleBox() });
    const rect: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const children = [{ node: child, minSize: { x: 40, y: 20 } }];
    const out = rects(panelContainerLayout(n, children, rect, ctx()));
    // x = 0 + (200-40) = 160; y = 0 + (100-20) = 80.
    expect(out.get('Panel/Child')).toEqual({ x: 160, y: 80, w: 40, h: 20 });
  });

  it('lays out every child against the SAME content rect (PanelContainer does not split space between children)', () => {
    const a = solveNode('Panel/A', { customMinimumSize: { x: 10, y: 10 } });
    const b = solveNode('Panel/B', { customMinimumSize: { x: 10, y: 10 } });
    const n = solveNode('Panel', {}, [a, b], { panel: styleBox({ left: 5, top: 5, right: 5, bottom: 5 }) });
    const rect: Rect2 = { x: 0, y: 0, w: 100, h: 60 };
    const children = [
      { node: a, minSize: { x: 10, y: 10 } },
      { node: b, minSize: { x: 10, y: 10 } },
    ];
    const out = rects(panelContainerLayout(n, children, rect, ctx()));
    expect(out.get('Panel/A')).toEqual({ x: 5, y: 5, w: 90, h: 50 });
    expect(out.get('Panel/B')).toEqual({ x: 5, y: 5, w: 90, h: 50 });
  });
});

describe('panelContainerLayout wired through the registry + full solve', () => {
  const TYPE = 'PanelContainer';

  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('end-to-end: a container inset by its panel style, with a FILL child stretched to the content rect', () => {
    controlSolverRegistry.registerMinimumSize(TYPE, panelContainerMinimumSize);
    controlSolverRegistry.registerContainerLayout(TYPE, panelContainerLayout);

    const child: SolveNode = {
      path: 'Panel/Child',
      node: {
        name: 'Child',
        type: 'Control',
        children: [],
        properties: { name: 'Child', customMinimumSize: { x: 10, y: 10 } } as ControlProperties,
      },
      children: [],
      styleBoxes: {},
      textureSize: null,
    };
    const root: SolveNode = {
      path: 'Panel',
      node: {
        name: 'Panel',
        type: TYPE,
        children: [],
        properties: { name: 'Panel', anchorsPreset: 15 } as ControlProperties, // FULL_RECT
      },
      children: [child],
      styleBoxes: { panel: styleBox({ left: 10, top: 6, right: 10, bottom: 6 }) },
      textureSize: null,
    };

    const viewport: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const solved = solveControlTree([root], viewport, ctx());
    expect(solved.get('Panel')?.rect).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(solved.get('Panel/Child')?.rect).toEqual({ x: 10, y: 6, w: 180, h: 88 });
  });
});
