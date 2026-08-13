/**
 * The Control rect solve, tested against `SolveNode` literals — no React, no
 * scene cache, no mocking. Every expected number is either a Godot source
 * citation (the preset table, `_size_changed`'s formula/floor) or a
 * hand-worked example from that same formula; none are re-derived the way
 * the implementation derives them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { ParsedHeading } from '../../../parser/utils';
import { parseControl } from '../../../nodes/2d/ui/control/parser';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { controlSolverRegistry, type ContainerLayoutFn, type SolveContext } from './solverRegistry';
import { combinedMinimumSize, createSolveContext, solveControlTree } from './controlRectSolver';
import { solveNode } from './testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };

/** A `ControlProperties`-shaped bag, loosely typed so fixtures can build one field at a time without satisfying the whole interface. */
type Props = Record<string, unknown>;

function node(path: string, type: string, properties: Props, children: SolveNode[] = []): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = {
    name,
    type,
    children: [],
    properties: { name, ...properties },
  };
  return { ...solveNode(), path, node: tscnNode, children };
}

function ctx(): SolveContext {
  return createSolveContext(nativeTheme(1));
}

/**
 * A `SolveNode` built the way the real render path builds one: raw
 * snake_case `.tscn` property keys, run through the real `parseControl`, with
 * `rawProperties`/`rawPropertiesOrderReliable` set exactly as
 * `core/NodeRegistry.ts` sets them for a genuinely single-file-scanned node
 * (ADR-0035) — so `resolveControlLayout`'s file-order simulation reads the
 * SAME `Object.keys(rawProperties)` order a real parse would produce, not a
 * hand-picked array a bug in the plumbing could silently disagree with.
 */
function orderedNode(path: string, type: string, rawProperties: Record<string, string>): SolveNode {
  const name = path.split('/').pop()!;
  const heading: ParsedHeading = { type: 'node', attributes: { name, type } };
  const tscnNode: TscnNode = {
    name,
    type,
    children: [],
    properties: parseControl(heading, rawProperties),
    rawProperties,
    rawPropertiesOrderReliable: true,
  };
  return { ...solveNode(), path, node: tscnNode, children: [] };
}

describe('solveControlTree — LayoutPreset table (control.cpp::set_anchors_preset)', () => {
  // scene/gui/control.cpp :: Control::set_anchors_preset (:1114-1229) — the four
  // per-edge switches this table transcribes. No offsets/custom minimum size, so
  // the resolved rect IS the anchor fraction times the 1152x648 viewport.
  // `layout_mode` is UNCONTROLLED (3) throughout: a parentless Control's stored
  // mode, and one of the two `_set_anchors_layout_preset` does not bail on
  // (control.cpp:990-993), so the preset is operational here.
  const presetRects: Record<number, Rect2> = {
    0: { x: 0, y: 0, w: 0, h: 0 }, // TOP_LEFT
    1: { x: 1152, y: 0, w: 0, h: 0 }, // TOP_RIGHT
    2: { x: 0, y: 648, w: 0, h: 0 }, // BOTTOM_LEFT
    3: { x: 1152, y: 648, w: 0, h: 0 }, // BOTTOM_RIGHT
    4: { x: 0, y: 324, w: 0, h: 0 }, // CENTER_LEFT
    5: { x: 576, y: 0, w: 0, h: 0 }, // CENTER_TOP
    6: { x: 1152, y: 324, w: 0, h: 0 }, // CENTER_RIGHT
    7: { x: 576, y: 648, w: 0, h: 0 }, // CENTER_BOTTOM
    8: { x: 576, y: 324, w: 0, h: 0 }, // CENTER
    9: { x: 0, y: 0, w: 0, h: 648 }, // LEFT_WIDE
    10: { x: 0, y: 0, w: 1152, h: 0 }, // TOP_WIDE
    11: { x: 1152, y: 0, w: 0, h: 648 }, // RIGHT_WIDE
    12: { x: 0, y: 648, w: 1152, h: 0 }, // BOTTOM_WIDE
    13: { x: 576, y: 0, w: 0, h: 648 }, // VCENTER_WIDE
    14: { x: 0, y: 324, w: 1152, h: 0 }, // HCENTER_WIDE
    15: { x: 0, y: 0, w: 1152, h: 648 }, // FULL_RECT
  };

  for (const [preset, expected] of Object.entries(presetRects)) {
    it(`preset ${preset} resolves to ${JSON.stringify(expected)}`, () => {
      const root = node('Root', 'Control', { layoutMode: 3, anchorsPreset: Number(preset) });
      const solved = solveControlTree([root], VIEWPORT, ctx());
      expect(solved.get('Root')?.rect).toEqual(expected);
    });
  }
});

describe('solveControlTree — explicit anchor_* + offset_* (incl. negative offsets)', () => {
  it('a centred anchor (0.5,0.5,0.5,0.5) with symmetric offsets sizes a centred dialog', () => {
    // edge_pos[i] = offset[i] + anchor[i] * area (control.cpp:1766-1767):
    // left = -50 + 0.5*1152 = 526, right = 50 + 0.5*1152 = 626 → w = 100
    // top = -20 + 0.5*648 = 304, bottom = 20 + 0.5*648 = 344 → h = 40
    const root = node('Root', 'Control', {
      anchorLeft: 0.5,
      anchorTop: 0.5,
      anchorRight: 0.5,
      anchorBottom: 0.5,
      offsetLeft: -50,
      offsetTop: -20,
      offsetRight: 50,
      offsetBottom: 20,
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 526, y: 304, w: 100, h: 40 });
  });

  it('anchors at 0 with a negative left/top offset places the rect partly off the parent', () => {
    // left = -10 + 0*1152 = -10, right = 90 + 0*1152 = 90 → w = 100
    // top = -5 + 0*648 = -5, bottom = 45 + 0*648 = 45 → h = 50
    const root = node('Root', 'Control', {
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: -10,
      offsetTop: -5,
      offsetRight: 90,
      offsetBottom: 45,
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: -10, y: -5, w: 100, h: 50 });
  });
});

describe('solveControlTree — size floored at custom_minimum_size', () => {
  it('clamps size up to custom_minimum_size, position unchanged under the default GROW_DIRECTION_END', () => {
    // control.cpp:1773-1797. Raw rect from centred anchors and a 10x10 offset
    // box: x=571,y=319,w=10,h=10. custom_minimum_size (80,24) > (10,10) on
    // both axes; GROW_DIRECTION_END (control.h:209-210, the default) leaves
    // position alone and only grows the size. The anchors are the explicit
    // four floats rather than the CENTER preset so that grow really is at that
    // default — the preset would have implied BOTH on both axes.
    const root = node('Root', 'Control', {
      anchorLeft: 0.5,
      anchorTop: 0.5,
      anchorRight: 0.5,
      anchorBottom: 0.5,
      offsetLeft: -5,
      offsetTop: -5,
      offsetRight: 5,
      offsetBottom: 5,
      customMinimumSize: { x: 80, y: 24 },
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 571, y: 319, w: 80, h: 24 });
  });

  it('GROW_DIRECTION_BEGIN/BOTH shift the position by the shortfall (control.cpp:1776-1794)', () => {
    // Same raw 10x10 box at (571,319). growHorizontal=BEGIN(0): x += 10-80 = -70 → 501.
    // growVertical=BOTH(2): y += 0.5*(10-24) = -7 → 312.
    const root = node('Root', 'Control', {
      anchorLeft: 0.5,
      anchorTop: 0.5,
      anchorRight: 0.5,
      anchorBottom: 0.5,
      offsetLeft: -5,
      offsetTop: -5,
      offsetRight: 5,
      offsetBottom: 5,
      customMinimumSize: { x: 80, y: 24 },
      growHorizontal: 0,
      growVertical: 2,
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 501, y: 312, w: 80, h: 24 });
  });
});

describe('solveControlTree — grow direction derived from anchors_preset', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  // `Control::_set_anchors_layout_preset` (control.cpp:982-1032) ends by calling
  // `set_grow_direction_preset` (:1373-1428), so a scene that authors only
  // `anchors_preset` still gets a non-END grow — Godot's editor does not
  // re-serialize the implied value, it re-derives it on load. Every expected
  // rect in this block was measured through real Godot 4.6.3 (`Control::get_rect()`
  // on a settled SubViewport of exactly this VIEWPORT size), not derived from
  // this solver.

  // One 10x10 raw box per preset, floored against a 40x40 custom_minimum_size so
  // the grow branch fires on BOTH axes for every row. The two WIDE-preset offsets
  // differ because a wide anchor pair would otherwise span the viewport and never
  // reach its minimum on that axis.
  const growMatrix: Array<{
    preset: number;
    label: string;
    anchors: [number, number, number, number];
    offsets: [number, number, number, number];
    expected: Rect2;
  }> = [
    // TOP_LEFT: (END, END) — the corpus's most common preset, and the guard that
    // the table's first entry did not shift: END already leaves position alone.
    { preset: 0, label: 'TOP_LEFT', anchors: [0, 0, 0, 0], offsets: [-5, -5, 5, 5], expected: { x: -5, y: -5, w: 40, h: 40 } },
    // TOP_RIGHT: (BEGIN, END) — x shifts back by the full 30px shortfall.
    { preset: 1, label: 'TOP_RIGHT', anchors: [1, 0, 1, 0], offsets: [-5, -5, 5, 5], expected: { x: 1117, y: -5, w: 40, h: 40 } },
    // BOTTOM_RIGHT: (BEGIN, BEGIN) — both axes shift back.
    { preset: 3, label: 'BOTTOM_RIGHT', anchors: [1, 1, 1, 1], offsets: [-5, -5, 5, 5], expected: { x: 1117, y: 613, w: 40, h: 40 } },
    // CENTER_TOP: (BOTH, END) — x splits the shortfall (571 - 15), y holds.
    { preset: 5, label: 'CENTER_TOP', anchors: [0.5, 0, 0.5, 0], offsets: [-5, -5, 5, 5], expected: { x: 556, y: -5, w: 40, h: 40 } },
    // CENTER_BOTTOM: (BOTH, BEGIN).
    { preset: 7, label: 'CENTER_BOTTOM', anchors: [0.5, 1, 0.5, 1], offsets: [-5, -5, 5, 5], expected: { x: 556, y: 613, w: 40, h: 40 } },
    // LEFT_WIDE: (END, BOTH) — the only row whose vertical anchors span the
    // viewport, so its offsets pull the raw box back to 10px tall (319..329).
    { preset: 9, label: 'LEFT_WIDE', anchors: [0, 0, 0, 1], offsets: [-5, 319, 5, -319], expected: { x: -5, y: 304, w: 40, h: 40 } },
  ];

  for (const { preset, label, anchors, offsets, expected } of growMatrix) {
    it(`preset ${preset} (${label}) floors to ${JSON.stringify(expected)} under layout_mode 1`, () => {
      const root = node('Root', 'Control', {
        layoutMode: 1,
        anchorsPreset: preset,
        anchorLeft: anchors[0],
        anchorTop: anchors[1],
        anchorRight: anchors[2],
        anchorBottom: anchors[3],
        offsetLeft: offsets[0],
        offsetTop: offsets[1],
        offsetRight: offsets[2],
        offsetBottom: offsets[3],
        customMinimumSize: { x: 40, y: 40 },
      });
      const solved = solveControlTree([root], VIEWPORT, ctx());
      expect(solved.get('Root')?.rect).toEqual(expected);
    });
  }

  it('a CENTER-preset node taller than its anchored box centres on the half-pixel', () => {
    // The shape a themed Button takes when its StyleBox content margins push its
    // combined minimum height past its anchored height. Raw box:
    // x = -60 + 0.5*1152 = 516, w = 120; y = -16 + 0.5*648 = 308, h = 32.
    // CENTER (8) implies v_grow = BOTH, so y += 0.5*(32 - 35) = -1.5 → 306.5,
    // a genuine half-pixel top. Real Godot's own get_rect() for this shape.
    const root = node('Root', 'Control', {
      layoutMode: 1,
      anchorsPreset: 8,
      offsetLeft: -60,
      offsetTop: -16,
      offsetRight: 60,
      offsetBottom: 16,
      customMinimumSize: { x: 0, y: 35 },
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 516, y: 306.5, w: 120, h: 35 });
  });

  it('the same CENTER-preset node is untouched when its minimum fits inside the anchored box', () => {
    // Grow direction is inert unless the floor branch fires — the raw anchored
    // rect stands whatever the preset implies.
    const root = node('Root', 'Control', {
      layoutMode: 1,
      anchorsPreset: 8,
      offsetLeft: -60,
      offsetTop: -16,
      offsetRight: 60,
      offsetBottom: 16,
      customMinimumSize: { x: 0, y: 0 },
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 516, y: 308, w: 120, h: 32 });
  });

  it('the same CENTER-preset node is wholly non-operational when layout_mode is absent', () => {
    // `_set_anchors_layout_preset` bails outside ANCHORS/UNCONTROLLED before
    // `set_anchors_preset` AND before `set_grow_direction_preset`
    // (control.cpp:990-993), and `stored_layout_mode` defaults to POSITION
    // (control.h:201), so a scene authoring no `layout_mode` line gets neither
    // half: anchors stay (0,0,0,0), so the raw box is the offsets themselves at
    // (-60,-16,120,32), and grow stays END, so the 35 minimum grows downward.
    const root = node('Root', 'Control', {
      anchorsPreset: 8,
      offsetLeft: -60,
      offsetTop: -16,
      offsetRight: 60,
      offsetBottom: 16,
      customMinimumSize: { x: 0, y: 35 },
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: -60, y: -16, w: 120, h: 35 });
  });

  it('an authored grow_vertical still wins over the preset it contradicts', () => {
    // Same node as the half-pixel case, with grow_vertical = END (1) authored:
    // the position holds at 308 despite CENTER implying BOTH.
    const root = node('Root', 'Control', {
      layoutMode: 1,
      anchorsPreset: 8,
      offsetLeft: -60,
      offsetTop: -16,
      offsetRight: 60,
      offsetBottom: 16,
      customMinimumSize: { x: 0, y: 35 },
      growVertical: 1,
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 516, y: 308, w: 120, h: 35 });
  });

  it("a container child's own preset-derived grow re-floors the cell it was handed", () => {
    // `Container::fit_child_in_rect` ends in `Control::set_rect` → `_size_changed`,
    // so a child handed a cell smaller than its own minimum still grows per its
    // OWN grow direction. Cell (0,0,10,10) against a 40x40 minimum, CENTER_TOP (5)
    // → (BOTH, END): x += 0.5*(10-40) = -15, y holds.
    const layout: ContainerLayoutFn = (n) =>
      new Map(n.children.map((child) => [child.path, { x: 0, y: 0, w: 10, h: 10 }]));
    controlSolverRegistry.registerContainerLayout('GrowCellContainer', layout);

    const child = node('Box/Child', 'Control', {
      layoutMode: 1,
      anchorsPreset: 5,
      customMinimumSize: { x: 40, y: 40 },
    });
    const root = node('Box', 'GrowCellContainer', { anchorsPreset: 15 }, [child]);
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Box/Child')?.rect).toEqual({ x: -15, y: 0, w: 40, h: 40 });
  });
});

describe('solveControlTree — nested free Controls resolve against their parent rect', () => {
  it("a FULL_RECT child under a free Control fills the PARENT's rect, not the viewport", () => {
    const child = node('Root/Child', 'Control', { layoutMode: 1, anchorsPreset: 15 });
    const root = node(
      'Root',
      'Control',
      { anchorLeft: 0, anchorTop: 0, anchorRight: 0, anchorBottom: 0, offsetLeft: 100, offsetTop: 50, offsetRight: 500, offsetBottom: 350 },
      [child]
    );
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 100, y: 50, w: 400, h: 300 });
    // Relative to the parent's own top-left (400x300), NOT the 1152x648 viewport.
    expect(solved.get('Root/Child')?.rect).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  it('a doubly-nested free Control resolves against its immediate parent two levels deep', () => {
    const grandchild = node('Root/Child/Grandchild', 'Control', {
      anchorLeft: 0.5,
      anchorTop: 0.5,
      anchorRight: 0.5,
      anchorBottom: 0.5,
      offsetLeft: -10,
      offsetTop: -10,
      offsetRight: 10,
      offsetBottom: 10,
    });
    const child = node('Root/Child', 'Control', { layoutMode: 1, anchorsPreset: 15 }, [grandchild]);
    const root = node(
      'Root',
      'Control',
      { anchorLeft: 0, anchorTop: 0, anchorRight: 0, anchorBottom: 0, offsetLeft: 0, offsetTop: 0, offsetRight: 200, offsetBottom: 100 },
      [child]
    );
    const solved = solveControlTree([root], VIEWPORT, ctx());
    // Child fills the 200x100 parent; grandchild centres in THAT (100,50) ± 10.
    expect(solved.get('Root/Child')?.rect).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(solved.get('Root/Child/Grandchild')?.rect).toEqual({ x: 90, y: 40, w: 20, h: 20 });
  });
});

describe('solveControlTree — unregistered types are leaves with minimum size (0, 0)', () => {
  it('combinedMinimumSize is (0,0) for a type with no registration and no custom_minimum_size', () => {
    const n = node('Leaf', 'ThisTypeIsNotRegistered', {});
    expect(combinedMinimumSize(n, ctx())).toEqual({ x: 0, y: 0 });
  });

  it('combinedMinimumSize floors to custom_minimum_size even for an unregistered type', () => {
    const n = node('Leaf', 'ThisTypeIsNotRegistered', { customMinimumSize: { x: 12, y: 34 } });
    expect(combinedMinimumSize(n, ctx())).toEqual({ x: 12, y: 34 });
  });
});

describe('solveControlTree — a registered ContainerLayoutFn overrides its children\'s anchors', () => {
  const TYPE = 'TestSolverStackContainer';

  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it("gives children rects from the container's fn instead of the free/anchor path", () => {
    // A minimal stack: each child gets the full container width and a fixed
    // 10px-tall row, one after another — deliberately NOT what the children's
    // own (unused) anchors would produce, to prove the container fn wins.
    const stack: ContainerLayoutFn = (_n, children, contentRect) => {
      const out = new Map<string, Rect2>();
      children.forEach((c, i) => {
        out.set(c.node.path, { x: 0, y: i * 10, w: contentRect.w, h: 10 });
      });
      return out;
    };
    controlSolverRegistry.registerContainerLayout(TYPE, stack);

    // This child's own anchors say FULL_RECT — if honoured, it would be
    // (0,0,1152,648), not the container's (0,0,1152,10).
    const child0 = node('Stack/Child0', 'Control', { layoutMode: 1, anchorsPreset: 15 });
    const child1 = node('Stack/Child1', 'Control', { layoutMode: 1, anchorsPreset: 15 });
    // The container itself still solves as a free Control — FULL_RECT so its
    // own rect (and so contentRect) is the 1152x648 viewport.
    const root = node('Stack', TYPE, { layoutMode: 3, anchorsPreset: 15 }, [child0, child1]);

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Stack/Child0')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 10 });
    expect(solved.get('Stack/Child1')?.rect).toEqual({ x: 0, y: 10, w: 1152, h: 10 });
  });

  it("re-floors a container-assigned rect against the child's FULL-PRECISION minimum", () => {
    // `Container::fit_child_in_rect` ends by calling `Control::set_rect`, and
    // `Control::_size_changed` (control.cpp:1531-1541,1760-1797 — a third file
    // neither container.cpp nor any container's own source names) re-floors the
    // rect against the child's own minimum. Containers that truncate their cell
    // bookkeeping to integers therefore hand out a cell SMALLER than a child
    // whose minimum is fractional, and the child still renders at its minimum.
    // Every real text minimum is fractional, so a solver that trusts the cell
    // verbatim is wrong for any Control carrying font metrics.
    const tinyCell: ContainerLayoutFn = (_n, children) => {
      const out = new Map<string, Rect2>();
      // Deliberately smaller than the child's minimum, and integer-truncated
      // the way grid_container.cpp's Size2i bookkeeping is.
      children.forEach((c) => out.set(c.node.path, { x: 0, y: 0, w: 100, h: 20 }));
      return out;
    };
    controlSolverRegistry.registerContainerLayout(TYPE, tinyCell);

    const child = node('Cells/Fractional', 'Control', {
      customMinimumSize: { x: 100.5, y: 20.5 },
    });
    const root = node('Cells', TYPE, { anchorsPreset: 15 }, [child]);

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Cells/Fractional')?.rect).toEqual({ x: 0, y: 0, w: 100.5, h: 20.5 });
  });

  it('applies the grow direction when re-flooring a container-assigned rect', () => {
    // Same re-floor, but GROW_DIRECTION_BEGIN (0) shifts the position back by
    // the whole shortfall rather than growing away from the origin.
    const tinyCell: ContainerLayoutFn = (_n, children) => {
      const out = new Map<string, Rect2>();
      children.forEach((c) => out.set(c.node.path, { x: 200, y: 100, w: 50, h: 30 }));
      return out;
    };
    controlSolverRegistry.registerContainerLayout(TYPE, tinyCell);

    const child = node('Cells/Grown', 'Control', {
      customMinimumSize: { x: 80, y: 30 },
      growHorizontal: 0,
    });
    const root = node('Cells', TYPE, { anchorsPreset: 15 }, [child]);

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Cells/Grown')?.rect).toEqual({ x: 170, y: 100, w: 80, h: 30 });
  });

  it("recurses into a container child's OWN children against the rect the container assigned it", () => {
    const stack: ContainerLayoutFn = (_n, children, contentRect) => {
      const out = new Map<string, Rect2>();
      children.forEach((c, i) => out.set(c.node.path, { x: 0, y: i * 20, w: contentRect.w, h: 20 }));
      return out;
    };
    controlSolverRegistry.registerContainerLayout(TYPE, stack);

    const grandchild = node('Stack/Child/Grandchild', 'Control', { layoutMode: 1, anchorsPreset: 15 });
    const child = node('Stack/Child', 'Control', { layoutMode: 1, anchorsPreset: 15 }, [grandchild]);
    const root = node('Stack', TYPE, { layoutMode: 3, anchorsPreset: 15 }, [child]);

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Stack/Child')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 20 });
    // Grandchild's FULL_RECT resolves against the 1152x20 rect the container gave Child.
    expect(solved.get('Stack/Child/Grandchild')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 20 });
  });
});

describe('solveControlTree — a registered canvas boundary (CanvasLayer)', () => {
  const BOUNDARY = 'TestCanvasBoundary';

  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('fills the rect it was handed instead of the (0,0) its absent anchors would give', () => {
    controlSolverRegistry.registerCanvasBoundary(BOUNDARY);
    const layer = node('Root/HUD', BOUNDARY, {});
    const root = node('Root', 'Control', { layoutMode: 3, anchorsPreset: 15 }, [layer]);

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root/HUD')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
  });

  it('lets a Control under it anchor against the full rect, not a degenerate one', () => {
    controlSolverRegistry.registerCanvasBoundary(BOUNDARY);
    // anchors_preset 1 (TOP_RIGHT) + the fixture's own offsets: left = -120 + 1*1152.
    const score = node('Root/HUD/Score', 'Control', {
      anchorLeft: 1,
      anchorRight: 1,
      offsetLeft: -120,
      offsetTop: 8,
      offsetRight: -8,
      offsetBottom: 32,
    });
    const layer = node('Root/HUD', BOUNDARY, {}, [score]);
    const root = node('Root', 'Control', { layoutMode: 3, anchorsPreset: 15 }, [layer]);

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root/HUD/Score')?.rect).toEqual({ x: 1032, y: 8, w: 112, h: 24 });
  });

  it('is unaffected by an enclosing container fn, which never owns a non-CanvasItem child', () => {
    const CONTAINER = 'TestContainerForBoundary';
    controlSolverRegistry.registerCanvasBoundary(BOUNDARY);
    controlSolverRegistry.registerContainerLayout(CONTAINER, (_n, children) => {
      const out = new Map<string, Rect2>();
      for (const c of children) out.set(c.node.path, { x: 5, y: 5, w: 10, h: 10 });
      return out;
    });

    const layer = node('Box/HUD', BOUNDARY, {});
    const box = node('Box', CONTAINER, { layoutMode: 3, anchorsPreset: 15 }, [layer]);

    const solved = solveControlTree([box], VIEWPORT, ctx());
    expect(solved.get('Box/HUD')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
  });
});

describe('solveControlTree — MinimumSizeFn/ContainerLayoutFn meta side-channel', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('a MinimumSizeFn returning a bare Vec2 (the old contract) leaves SolvedControl.meta undefined', () => {
    const TYPE = 'TestBareVec2MinimumSize';
    controlSolverRegistry.registerMinimumSize(TYPE, () => ({ x: 10, y: 20 }));

    const root = node('Leaf', TYPE, {});
    const solved = solveControlTree([root], VIEWPORT, ctx());

    expect(solved.get('Leaf')?.minSize).toEqual({ x: 10, y: 20 });
    expect(solved.get('Leaf')?.meta).toBeUndefined();
  });

  it('a MinimumSizeFn returning { size, meta } floors `size` as before and surfaces `meta` on SolvedControl', () => {
    const TYPE = 'TestMetaMinimumSize';
    const layout = { widthPx: 42 };
    controlSolverRegistry.registerMinimumSize(TYPE, () => ({ size: { x: 10, y: 20 }, meta: layout }));

    const root = node('Leaf', TYPE, {});
    const solved = solveControlTree([root], VIEWPORT, ctx());

    expect(solved.get('Leaf')?.minSize).toEqual({ x: 10, y: 20 });
    expect(solved.get('Leaf')?.meta).toBe(layout);
  });

  it('{ size, meta }\'s `size` still floors to custom_minimum_size exactly like a bare Vec2', () => {
    const TYPE = 'TestMetaMinimumSizeFloored';
    controlSolverRegistry.registerMinimumSize(TYPE, () => ({ size: { x: 5, y: 5 }, meta: 'x' }));

    const root = node('Leaf', TYPE, { customMinimumSize: { x: 50, y: 5 } });
    const solved = solveControlTree([root], VIEWPORT, ctx());

    expect(solved.get('Leaf')?.minSize).toEqual({ x: 50, y: 5 });
    expect(solved.get('Leaf')?.meta).toBe('x');
  });

  it('a ContainerLayoutFn returning a bare Map (the old contract) leaves the container\'s own SolvedControl.meta undefined', () => {
    const TYPE = 'TestBareMapContainer';
    controlSolverRegistry.registerContainerLayout(TYPE, (_n, children) => {
      const out = new Map<string, Rect2>();
      for (const c of children) out.set(c.node.path, { x: 0, y: 0, w: 10, h: 10 });
      return out;
    });

    const child = node('Root/Child', 'Control', {});
    const root = node('Root', TYPE, { anchorsPreset: 15 }, [child]);
    const solved = solveControlTree([root], VIEWPORT, ctx());

    expect(solved.get('Root')?.meta).toBeUndefined();
    expect(solved.get('Root/Child')?.rect).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("a ContainerLayoutFn returning { rects, meta } surfaces `meta` on the CONTAINER's own SolvedControl, not its children's", () => {
    const TYPE = 'TestMetaContainer';
    const layoutMeta = { draggerPos: 77 };
    controlSolverRegistry.registerContainerLayout(TYPE, (_n, children) => {
      const rects = new Map<string, Rect2>();
      for (const c of children) rects.set(c.node.path, { x: 0, y: 0, w: 10, h: 10 });
      return { rects, meta: layoutMeta };
    });

    const child = node('Root/Child', 'Control', {});
    const root = node('Root', TYPE, { anchorsPreset: 15 }, [child]);
    const solved = solveControlTree([root], VIEWPORT, ctx());

    expect(solved.get('Root')?.meta).toBe(layoutMeta);
    expect(solved.get('Root/Child')?.rect).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(solved.get('Root/Child')?.meta).toBeUndefined();
  });

  it("a child's own MinimumSizeFn meta survives being laid out by a container (the two metas don't collide)", () => {
    const CONTAINER = 'TestMetaContainerParent';
    const LEAF = 'TestMetaLeafChild';
    controlSolverRegistry.registerContainerLayout(CONTAINER, (_n, children) => {
      const rects = new Map<string, Rect2>();
      for (const c of children) rects.set(c.node.path, { x: 0, y: 0, w: 10, h: 10 });
      return { rects, meta: 'container-meta' };
    });
    controlSolverRegistry.registerMinimumSize(LEAF, () => ({ size: { x: 1, y: 1 }, meta: 'leaf-meta' }));

    const child = node('Root/Child', LEAF, {});
    const root = node('Root', CONTAINER, { anchorsPreset: 15 }, [child]);
    const solved = solveControlTree([root], VIEWPORT, ctx());

    expect(solved.get('Root')?.meta).toBe('container-meta');
    expect(solved.get('Root/Child')?.meta).toBe('leaf-meta');
  });
});

describe('solveControlTree — a second pass for a size-dependent MinimumSizeFn (TextureRect FIT_*)', () => {
  const TYPE = 'TestTentativeRectMinimumSize';

  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('SolveContext.tentativeRect is undefined on a tree with no registered size-dependent type', () => {
    let seenTentative: Rect2 | undefined | 'never-called' = 'never-called';
    controlSolverRegistry.registerMinimumSize(TYPE, (n, c) => {
      seenTentative = c.tentativeRect?.(n);
      return { x: 0, y: 0 };
    });
    // Deliberately NOT calling registerSizeDependentMinimum(TYPE).

    const root = node('Leaf', TYPE, {});
    solveControlTree([root], VIEWPORT, ctx());

    expect(seenTentative).toBeUndefined();
  });

  it("re-solves once more when a type opts in, feeding the SECOND pass's MinimumSizeFn the FIRST pass's own resolved rect", () => {
    const seenTentative: Array<Rect2 | undefined> = [];
    controlSolverRegistry.registerMinimumSize(TYPE, (n, c) => {
      const t = c.tentativeRect?.(n);
      seenTentative.push(t);
      // First pass: no tentative rect yet, contributes nothing. Second pass:
      // floors width to double the tentative rect's own height.
      return { x: t ? t.h * 2 : 0, y: 0 };
    });
    controlSolverRegistry.registerSizeDependentMinimum(TYPE);

    // Zero-width anchors (left=right=0) but a bottom anchor of 1 floors this
    // node's HEIGHT to 100 independent of its own (width-only) minimum — the
    // width starts at 0, so the height-derived floor is the only thing that
    // can ever widen it.
    const root = node('Leaf', TYPE, { anchorBottom: 1, offsetBottom: -548 });
    const solved = solveControlTree([root], VIEWPORT, ctx());

    // Two passes ran: first with no tentative rect, second with the first's.
    expect(seenTentative).toEqual([undefined, { x: 0, y: 0, w: 0, h: 100 }]);
    // The SECOND pass's width floor (100 * 2 = 200) wins in the final result.
    expect(solved.get('Leaf')?.rect).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('a tree with the type registered but ABSENT from it never triggers a second pass', () => {
    controlSolverRegistry.registerMinimumSize(TYPE, () => ({ x: 0, y: 0 }));
    controlSolverRegistry.registerSizeDependentMinimum(TYPE);

    let calls = 0;
    const OTHER = 'TestUnrelatedType';
    controlSolverRegistry.registerMinimumSize(OTHER, () => {
      calls++;
      return { x: 1, y: 1 };
    });

    const root = node('Leaf', OTHER, {});
    solveControlTree([root], VIEWPORT, ctx());

    expect(calls).toBe(1);
  });
});

describe('solveControlTree — file-order-aware Control layout (ADR-0035, Option B)', () => {
  // The ADR's own measured acceptance case, exercised end-to-end through the
  // solver (`SolveNode.node.rawProperties` → `resolveControlLayout` →
  // `computeAnchoredRect`'s formula), not just against the resolver directly.
  // `Control::_set_anchors_layout_preset` (control.cpp:982-1032) calls
  // `set_anchors_preset` then `set_offsets_preset`; a later `offset_*` line
  // (its own setter, `Control::set_offset`, control.cpp:798-805) overwrites
  // what the preset wrote, and an earlier one is wiped BY the preset.
  it('offsets authored BEFORE anchors_preset=15 are wiped to (0, 0, 1152, 648)', () => {
    const root = orderedNode('Root', 'Control', {
      layout_mode: '3',
      offset_left: '40',
      offset_top: '40',
      offset_right: '240',
      offset_bottom: '160',
      anchors_preset: '15',
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
  });

  it('the SAME offsets authored AFTER anchors_preset=15 survive, landing at (40, 40, 1352, 768)', () => {
    const root = orderedNode('Root', 'Control', {
      layout_mode: '3',
      anchors_preset: '15',
      offset_left: '40',
      offset_top: '40',
      offset_right: '240',
      offset_bottom: '160',
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 40, y: 40, w: 1352, h: 768 });
  });

  it('anchors_preset authored BEFORE layout_mode does nothing at all — the gate reads stale state (control.cpp:991-993)', () => {
    const root = orderedNode('Root', 'Control', {
      anchors_preset: '15',
      layout_mode: '3',
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    // The preset never ran, so anchors/offsets/grow direction stay at the
    // struct default — the same (0,0,0,0) rect as TOP_LEFT (preset 0).
    expect(solved.get('Root')?.rect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('a merged-instance-root node (rawPropertiesOrderReliable: false) falls back to the editor-save-order assumption', () => {
    // Same raw bag as the "before" case above, but flagged unreliable — the
    // solver must NOT simulate file order for it, so the explicit offsets
    // (authored second in `resolveOffsets`'s per-side `??` sense) still win,
    // exactly like `resolveAnchors`/`resolveOffsets` did before this change.
    const heading: ParsedHeading = { type: 'node', attributes: { name: 'Root', type: 'Control' } };
    const rawProperties = {
      layout_mode: '3',
      offset_left: '40',
      offset_top: '40',
      offset_right: '240',
      offset_bottom: '160',
      anchors_preset: '15',
    };
    const tscnNode: TscnNode = {
      name: 'Root',
      type: 'Control',
      children: [],
      properties: parseControl(heading, rawProperties),
      rawProperties,
      rawPropertiesOrderReliable: false,
    };
    const root: SolveNode = { ...solveNode(), path: 'Root', node: tscnNode, children: [] };

    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 40, y: 40, w: 1352, h: 768 });
  });

  it('a hand-built node with no rawProperties at all also falls back (no order to read)', () => {
    // The pre-existing `node()` helper never sets rawProperties/
    // rawPropertiesOrderReliable — this is the SAME shape every OTHER test in
    // this file already uses, so it doubles as a regression guard: those 700+
    // lines of pre-existing assertions must keep passing unchanged.
    const root = node('Root', 'Control', {
      layoutMode: 3,
      offsetLeft: 40,
      offsetTop: 40,
      offsetRight: 240,
      offsetBottom: 160,
      anchorsPreset: 15,
    });
    const solved = solveControlTree([root], VIEWPORT, ctx());
    expect(solved.get('Root')?.rect).toEqual({ x: 40, y: 40, w: 1352, h: 768 });
  });
});
