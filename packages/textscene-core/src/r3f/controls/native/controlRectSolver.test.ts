/**
 * The Control rect solve, tested against `SolveNode` literals — no React, no
 * scene cache, no mocking. Every expected number is either a Godot source
 * citation (the preset table, `_size_changed`'s formula/floor) or a
 * hand-worked example from that same formula; none are re-derived the way
 * the implementation derives them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { controlSolverRegistry, type ContainerLayoutFn, type SolveContext } from './solverRegistry';
import { combinedMinimumSize, createSolveContext, solveControlTree } from './controlRectSolver';

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
  return { path, node: tscnNode, children, styleBoxes: {}, textureSize: null };
}

function ctx(): SolveContext {
  return createSolveContext(nativeTheme(1));
}

describe('solveControlTree — LayoutPreset table (control.cpp::set_anchors_preset)', () => {
  // scene/gui/control.cpp :: Control::set_anchors_preset (:1114-1229) — the four
  // per-edge switches this table transcribes. No offsets/custom minimum size, so
  // the resolved rect IS the anchor fraction times the 1152x648 viewport.
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
      const root = node('Root', 'Control', { anchorsPreset: Number(preset) });
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
    // control.cpp:1773-1797. Raw rect from anchorsPreset=8 (CENTER) with a
    // 10x10 offset box: x=571,y=319,w=10,h=10 (see the preset-table describe
    // block for the base 576,324 CENTER point). custom_minimum_size (80,24) >
    // (10,10) on both axes; GROW_DIRECTION_END (control.h:209-210, the
    // default) leaves position alone and only grows the size.
    const root = node('Root', 'Control', {
      anchorsPreset: 8,
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
      anchorsPreset: 8,
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

describe('solveControlTree — nested free Controls resolve against their parent rect', () => {
  it("a FULL_RECT child under a free Control fills the PARENT's rect, not the viewport", () => {
    const child = node('Root/Child', 'Control', { anchorsPreset: 15 });
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
    const child = node('Root/Child', 'Control', { anchorsPreset: 15 }, [grandchild]);
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

describe('solveControlTree — paintIndex is pre-order with siblings pre-sorted by z_index', () => {
  it('sorts roots and each sibling group by z_index (canvas_item.h:101), ties keeping author order', () => {
    const c1 = node('R1/C1', 'Control', { zIndex: 2 });
    const c2 = node('R1/C2', 'Control', { zIndex: 0 });
    const r1 = node('R1', 'Control', { zIndex: 5 }, [c1, c2]); // authored [C1, C2]
    const r2 = node('R2', 'Control', { zIndex: 1 });

    // Roots authored [R1, R2] but R2 (z=1) sorts before R1 (z=5).
    const solved = solveControlTree([r1, r2], VIEWPORT, ctx());

    expect(solved.get('R2')?.paintIndex).toBe(0);
    expect(solved.get('R1')?.paintIndex).toBe(1);
    // R1's children [C1(z=2), C2(z=0)] sort to [C2, C1].
    expect(solved.get('R1/C2')?.paintIndex).toBe(2);
    expect(solved.get('R1/C1')?.paintIndex).toBe(3);
  });

  it('defaults an absent z_index to 0 (canvas_item.h:101)', () => {
    const a = node('A', 'Control', {});
    const b = node('B', 'Control', { zIndex: -1 });
    const solved = solveControlTree([a, b], VIEWPORT, ctx());
    expect(solved.get('B')?.paintIndex).toBe(0);
    expect(solved.get('A')?.paintIndex).toBe(1);
  });
});

describe('solveControlTree — subtreeLastPaintIndex (INTERNAL_MODE_BACK chrome ordering)', () => {
  // `scene/gui/scroll_container.cpp:919,924` adds `h_scroll`/`v_scroll` via
  // `Node::add_child(..., INTERNAL_MODE_BACK)` — internal children placed
  // AFTER every normal child, so they paint last regardless of when they were
  // added. `subtreeLastPaintIndex` is the plain pre-order fact a consumer
  // needs to reproduce that: the paint index of the LAST node visited within
  // this node's own subtree (itself, for a leaf).
  it("a leaf's subtreeLastPaintIndex equals its own paintIndex", () => {
    const leaf = node('Leaf', 'Control', {});
    const solved = solveControlTree([leaf], VIEWPORT, ctx());
    const entry = solved.get('Leaf')!;
    expect(entry.paintIndex).toBe(0);
    expect(entry.subtreeLastPaintIndex).toBe(0);
  });

  it("a parent's subtreeLastPaintIndex is the deepest/last descendant's own paintIndex", () => {
    const grandchild = node('Root/Child/Grandchild', 'Control', {});
    const child = node('Root/Child', 'Control', {}, [grandchild]);
    const root = node('Root', 'Control', {}, [child]);
    const solved = solveControlTree([root], VIEWPORT, ctx());

    // Pre-order: Root=0, Child=1, Grandchild=2.
    expect(solved.get('Root/Child/Grandchild')?.paintIndex).toBe(2);
    expect(solved.get('Root')?.subtreeLastPaintIndex).toBe(2);
    expect(solved.get('Root/Child')?.subtreeLastPaintIndex).toBe(2);
    expect(solved.get('Root/Child/Grandchild')?.subtreeLastPaintIndex).toBe(2);
  });

  it('reorders by z_index before assigning paint indices, and subtreeLastPaintIndex tracks the SORTED last child', () => {
    // Authored [First, Second] but First has the higher z_index, so it sorts
    // AFTER Second (canvas_item.h:101) — the parent's subtreeLastPaintIndex
    // must follow the sorted order, not authoring order.
    const first = node('Root/First', 'Control', { zIndex: 5 });
    const second = node('Root/Second', 'Control', { zIndex: 0 });
    const root = node('Root', 'Control', {}, [first, second]);
    const solved = solveControlTree([root], VIEWPORT, ctx());

    // Sorted [Second, First]: Root=0, Second=1, First=2.
    expect(solved.get('Root/Second')?.paintIndex).toBe(1);
    expect(solved.get('Root/First')?.paintIndex).toBe(2);
    expect(solved.get('Root')?.subtreeLastPaintIndex).toBe(2);
  });

  it("the next sibling's own paintIndex is exactly one past the previous sibling's subtreeLastPaintIndex", () => {
    const grandchild = node('Root/Child/Grandchild', 'Control', {});
    const child = node('Root/Child', 'Control', {}, [grandchild]);
    const root = node('Root', 'Control', {}, [child]);
    const sibling = node('Sibling', 'Control', {});
    const solved = solveControlTree([root, sibling], VIEWPORT, ctx());

    const rootSubtreeLast = solved.get('Root')!.subtreeLastPaintIndex;
    expect(solved.get('Sibling')?.paintIndex).toBe(rootSubtreeLast + 1);
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
    const child0 = node('Stack/Child0', 'Control', { anchorsPreset: 15 });
    const child1 = node('Stack/Child1', 'Control', { anchorsPreset: 15 });
    // The container itself still solves as a free Control — FULL_RECT so its
    // own rect (and so contentRect) is the 1152x648 viewport.
    const root = node('Stack', TYPE, { anchorsPreset: 15 }, [child0, child1]);

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

    const grandchild = node('Stack/Child/Grandchild', 'Control', { anchorsPreset: 15 });
    const child = node('Stack/Child', 'Control', { anchorsPreset: 15 }, [grandchild]);
    const root = node('Stack', TYPE, { anchorsPreset: 15 }, [child]);

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
    const root = node('Root', 'Control', { anchorsPreset: 15 }, [layer]);

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
    const root = node('Root', 'Control', { anchorsPreset: 15 }, [layer]);

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
    const box = node('Box', CONTAINER, { anchorsPreset: 15 }, [layer]);

    const solved = solveControlTree([box], VIEWPORT, ctx());
    expect(solved.get('Box/HUD')?.rect).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
  });
});
