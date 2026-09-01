/**
 * SplitContainer's native rect solve, tested against literal inputs — no
 * React, no scene cache, no TscnParser (except the integration tests that
 * read the actual committed fixtures). Every expected number is either:
 *  - reproduced from `unit-split-container.tscn`/`unit-split-container-vertical.tscn`'s
 *    own `comparison.md` table, itself measured against real Godot 4.6.3
 *    (`pnpm ref:godot --mode 2d`, pixel-scanned for the colour edge), or
 *  - a synthetic `custom_minimum_size` case (never a Label) exercising the
 *    CLAMP path neither fixture's all-zero-minimum rows can reach, per this
 *    packet's own guidance to keep a font-metric regression and a `_resort`
 *    regression from ever presenting as the same failure.
 * None are re-derived the way the implementation derives them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TscnNode } from '../../../../parser/types';
import { TscnParser } from '../../../../parser/TscnParser';
import { fixturesDir } from '../../../../parser/testing/parserKit';
import { joinPath } from '../../../../utils/nodePath';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import {
  computeSplitDraggerPosition,
  isSplitGrabberVisible,
  makeSplitContainerLayout,
  makeSplitContainerMinimumSize,
  resolveSplitSeparation,
  resortSplitContainer,
  splitContainerMinimumSize,
  splitGrabberIconRect,
  DRAGGER_VISIBLE,
  type SplitAxisChild,
  type SplitChildInput,
} from './splitContainerSolver';
import type { SplitContainerProperties } from './splitContainer';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const FILL = 1;
const EXPAND_FILL = 3; // SIZE_FILL | SIZE_EXPAND

function child(overrides: Partial<SplitChildInput> = {}): SplitChildInput {
  return {
    minSize: { x: 0, y: 0 },
    hSizeFlags: FILL,
    vSizeFlags: FILL,
    stretchRatio: 1,
    ...overrides,
  };
}

function axisChild(overrides: Partial<SplitAxisChild> = {}): SplitAxisChild {
  return { minSize: 0, expands: false, stretchRatio: 1, ...overrides };
}

// --- computeSplitDraggerPosition — the closed-form offset -------------------
// Every row below is `unit-split-container.tscn`'s own comparison.md table,
// 400px wide, sep 12 unless noted (measured via `pnpm ref:godot --mode 2d`).

describe('computeSplitDraggerPosition — unit-split-container.tscn rows, reproduced', () => {
  it('Both: both expand equally, split_offset 0 -> 194 | 12 | 194', () => {
    const pos = computeSplitDraggerPosition(400, 12, axisChild({ expands: true }), axisChild({ expands: true }), 0, false);
    expect(pos).toBe(194);
    expect(400 - pos - 12).toBe(194);
  });

  it('Offset: both expand, split_offset 60 -> 254 | 12 | 134', () => {
    const pos = computeSplitDraggerPosition(400, 12, axisChild({ expands: true }), axisChild({ expands: true }), 60, false);
    expect(pos).toBe(254);
    expect(400 - pos - 12).toBe(134);
  });

  it('Ratio: stretch_ratio 3:1 -> 294 | 12 | 94', () => {
    const first = axisChild({ expands: true, stretchRatio: 3 });
    const second = axisChild({ expands: true, stretchRatio: 1 });
    const pos = computeSplitDraggerPosition(400, 12, first, second, 0, false);
    expect(pos).toBe(294);
    expect(400 - pos - 12).toBe(94);
  });

  it('FirstOnly: only the first expands -> 388 | 12 | 0 (first eats everything but the reserved separation)', () => {
    const pos = computeSplitDraggerPosition(400, 12, axisChild({ expands: true }), axisChild(), 0, false);
    expect(pos).toBe(388);
    expect(400 - pos - 12).toBe(0);
  });

  it('Neither: neither expands, split_offset 120 -> 120 | 12 | 268 (rest position is 0, offset supplies the rest)', () => {
    const pos = computeSplitDraggerPosition(400, 12, axisChild(), axisChild(), 120, false);
    expect(pos).toBe(120);
    expect(400 - pos - 12).toBe(268);
  });

  it('second-only expands: rest position is also 0, same as neither', () => {
    const pos = computeSplitDraggerPosition(400, 12, axisChild(), axisChild({ expands: true }), 0, false);
    expect(pos).toBe(0);
  });

  it('SepZero: separation overridden to 0 but floored elsewhere; here at sep=8 (the floored value) -> 196 | 8 | 196', () => {
    const pos = computeSplitDraggerPosition(400, 8, axisChild({ expands: true }), axisChild({ expands: true }), 0, false);
    expect(pos).toBe(196);
    expect(400 - pos - 8).toBe(196);
  });

  it('Collapsed: split_offset 60 ignored while collapsed -> same as Both (194 | 12 | 194)', () => {
    const pos = computeSplitDraggerPosition(400, 12, axisChild({ expands: true }), axisChild({ expands: true }), 60, true);
    expect(pos).toBe(194);
  });

  it('DraggerCollapsed: HIDDEN_COLLAPSED forces sep=0 -> 200 | 0 | 200', () => {
    const pos = computeSplitDraggerPosition(400, 0, axisChild({ expands: true }), axisChild({ expands: true }), 0, false);
    expect(pos).toBe(200);
  });
});

describe('computeSplitDraggerPosition — unit-split-container-vertical.tscn rows, reproduced', () => {
  it('Both: both expand vertically -> 144 | 12 | 144 (height 300)', () => {
    const pos = computeSplitDraggerPosition(300, 12, axisChild({ expands: true }), axisChild({ expands: true }), 0, false);
    expect(pos).toBe(144);
  });

  it('Offset: split_offset 50 -> 194 | 12 | 94', () => {
    const pos = computeSplitDraggerPosition(300, 12, axisChild({ expands: true }), axisChild({ expands: true }), 50, false);
    expect(pos).toBe(194);
    expect(300 - pos - 12).toBe(94);
  });
});

// --- The clamp — no fixture row exercises a nonzero minimum, so these are ---
// synthetic custom_minimum_size cases.

describe('computeSplitDraggerPosition — CLAMP against synthetic custom_minimum_size', () => {
  it('split_offset pushed below the first child minimum clamps up to it', () => {
    // Neither expands: rest position 0; split_offset -50 would go negative,
    // clamped to first.minSize (30).
    const pos = computeSplitDraggerPosition(
      400,
      12,
      axisChild({ minSize: 30 }),
      axisChild({ minSize: 0 }),
      -50,
      false
    );
    expect(pos).toBe(30);
  });

  it('split_offset pushed past the valid range clamps to size - sep - second.minSize', () => {
    const pos = computeSplitDraggerPosition(
      400,
      12,
      axisChild({ minSize: 0 }),
      axisChild({ minSize: 40 }),
      500,
      false
    );
    expect(pos).toBe(400 - 12 - 40);
  });

  it('both expand equally but the computed midpoint undercuts the first minimum: clamps up', () => {
    // Unclamped midpoint would be 194 (as in "Both"); a 250px first-child
    // minimum forces the dragger to sit at 250 instead.
    const pos = computeSplitDraggerPosition(
      400,
      12,
      axisChild({ expands: true, minSize: 250 }),
      axisChild({ expands: true }),
      0,
      false
    );
    expect(pos).toBe(250);
  });

  it('collapsed still clamps even though split_offset is ignored', () => {
    const pos = computeSplitDraggerPosition(
      400,
      12,
      axisChild({ minSize: 300 }),
      axisChild(),
      9999, // ignored while collapsed
      true
    );
    expect(pos).toBe(300); // "neither expands" rest position (0) clamped up to first.minSize
  });
});

// --- resortSplitContainer — full rects, both axes ---------------------------

describe('resortSplitContainer', () => {
  it('returns an empty array for zero children', () => {
    expect(resortSplitContainer(false, { width: 400, height: 60 }, 12, 0, false, [])).toEqual([]);
  });

  it('a lone child fits the WHOLE container rect, both axes', () => {
    const rects = resortSplitContainer(false, { width: 400, height: 60 }, 12, 0, false, [
      child({ minSize: { x: 10, y: 10 } }),
    ]);
    expect(rects).toEqual<Rect2[]>([{ x: 0, y: 0, w: 400, h: 60 }]);
  });

  it('HSplitContainer "Both" row: two FILL|EXPAND children, 400x60, sep 12', () => {
    const rects = resortSplitContainer(false, { width: 400, height: 60 }, 12, 0, false, [
      child({ hSizeFlags: EXPAND_FILL }),
      child({ hSizeFlags: EXPAND_FILL }),
    ]);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 194, h: 60 },
      { x: 206, y: 0, w: 194, h: 60 },
    ]);
  });

  it('VSplitContainer "Both" column: two FILL|EXPAND children on the vertical axis, 120x300, sep 12', () => {
    const rects = resortSplitContainer(true, { width: 120, height: 300 }, 12, 0, false, [
      child({ vSizeFlags: EXPAND_FILL }),
      child({ vSizeFlags: EXPAND_FILL }),
    ]);
    expect(rects).toEqual<Rect2[]>([
      { x: 0, y: 0, w: 120, h: 144 },
      { x: 0, y: 156, w: 120, h: 144 },
    ]);
  });

  it('reading the wrong axis is a real bug the vertical fixture exists to catch: horizontal flags on a VSplitContainer take the "neither" branch', () => {
    const rects = resortSplitContainer(true, { width: 120, height: 300 }, 12, 0, false, [
      child({ hSizeFlags: EXPAND_FILL }), // claims nothing — VSplit reads vSizeFlags
      child({ hSizeFlags: EXPAND_FILL }),
    ]);
    expect(rects[0]).toEqual<Rect2>({ x: 0, y: 0, w: 120, h: 0 });
  });
});

// --- splitContainerMinimumSize -----------------------------------------------

describe('splitContainerMinimumSize', () => {
  it('sums both children plus ONE separation on the main axis; cross axis is the largest (horizontal)', () => {
    const sizes = [{ x: 50, y: 20 }, { x: 80, y: 30 }];
    expect(splitContainerMinimumSize(false, 12, sizes)).toEqual({ x: 50 + 80 + 12, y: 30 });
  });

  it('sums both children plus ONE separation on the main axis; cross axis is the largest (vertical)', () => {
    const sizes = [{ x: 20, y: 50 }, { x: 30, y: 80 }];
    expect(splitContainerMinimumSize(true, 12, sizes)).toEqual({ x: 30, y: 50 + 80 + 12 });
  });

  it('a single child needs no separation', () => {
    expect(splitContainerMinimumSize(false, 99, [{ x: 40, y: 12 }])).toEqual({ x: 40, y: 12 });
  });

  it('no children => zero', () => {
    expect(splitContainerMinimumSize(false, 10, [])).toEqual({ x: 0, y: 0 });
  });
});

// --- resolveSplitSeparation ---------------------------------------------------

describe('resolveSplitSeparation', () => {
  const THEME = { separation: 12, grabberExtent: 8 };

  function separationProps(overrides: Partial<SplitContainerProperties> = {}): SplitContainerProperties {
    return { name: 'Split', ...overrides };
  }

  it('uses the theme default (12) when nothing overrides it', () => {
    expect(resolveSplitSeparation(separationProps(), THEME)).toBe(12);
  });

  it('floors an undersized theme_override_constants/separation at the grabber extent (8)', () => {
    expect(resolveSplitSeparation(separationProps({ themeOverrideConstants: { separation: 0 } }), THEME)).toBe(8);
  });

  it('honours an oversized override', () => {
    expect(resolveSplitSeparation(separationProps({ themeOverrideConstants: { separation: 30 } }), THEME)).toBe(30);
  });

  it('forces 0 for DRAGGER_HIDDEN_COLLAPSED regardless of theme/override', () => {
    expect(
      resolveSplitSeparation(
        separationProps({ draggerVisibility: 2, themeOverrideConstants: { separation: 99 } }),
        THEME
      )
    ).toBe(0);
  });
});

// --- Grabber visibility + rect ------------------------------------------------

function props(overrides: Partial<SplitContainerProperties> = {}): SplitContainerProperties {
  return { name: 'Split', ...overrides };
}

describe('isSplitGrabberVisible', () => {
  it('hidden by DEFAULT: autohide theme default (true) with no mouse/drag state a static render ever has', () => {
    expect(isSplitGrabberVisible(props(), { autohide: true })).toBe(false);
  });

  it('visible when a scene overrides autohide to 0', () => {
    expect(isSplitGrabberVisible(props({ themeOverrideConstants: { autohide: 0 } }), { autohide: true })).toBe(true);
  });

  it('still hidden with autohide overridden false if dragger_visibility is not VISIBLE', () => {
    expect(
      isSplitGrabberVisible(
        props({ themeOverrideConstants: { autohide: 0 }, draggerVisibility: 2 }),
        { autohide: true }
      )
    ).toBe(false);
  });

  it('still hidden with autohide overridden false while collapsed', () => {
    expect(
      isSplitGrabberVisible(props({ themeOverrideConstants: { autohide: 0 }, collapsed: true }), { autohide: true })
    ).toBe(false);
  });

  it('DRAGGER_VISIBLE is the explicit default enum value', () => {
    expect(DRAGGER_VISIBLE).toBe(0);
  });
});

describe('splitGrabberIconRect', () => {
  it('centres an 8x48 icon in the horizontal separation band (HSplitContainer)', () => {
    const rect = splitGrabberIconRect(false, { width: 400, height: 60 }, 194, 12, { x: 8, y: 48 });
    // split_bar_rect = (194, 0, 12, 60); tex_pos = pos + (size - tex)*0.5
    expect(rect).toEqual<Rect2>({ x: 194 + (12 - 8) / 2, y: (60 - 48) / 2, w: 8, h: 48 });
  });

  it('centres a 48x8 icon in the vertical separation band (VSplitContainer)', () => {
    const rect = splitGrabberIconRect(true, { width: 120, height: 300 }, 144, 12, { x: 48, y: 8 });
    expect(rect).toEqual<Rect2>({ x: (120 - 48) / 2, y: 144 + (12 - 8) / 2, w: 48, h: 8 });
  });
});

// --- End-to-end through the registry (ContainerLayoutFn/MinimumSizeFn wiring) ---

function solveNode(path: string, type: string, properties: Record<string, unknown>, children: SolveNode[] = []): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type, children: [], properties: { name, ...properties } };
  return { ...emptySolveNode(), path, node: tscnNode, children };
}

describe('makeSplitContainerLayout / makeSplitContainerMinimumSize — registered end-to-end', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('reproduces the "Ratio" row (3:1 stretch) through the full solve', () => {
    controlSolverRegistry.registerContainerLayout('HSplitContainer', makeSplitContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HSplitContainer', makeSplitContainerMinimumSize(false));

    const root = solveNode('Split', 'HSplitContainer', {
      layoutMode: 1,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 400,
      offsetBottom: 60,
    }, [
      solveNode('Split/RatioLeft', 'Control', {
        layoutMode: 2,
        sizeFlagsHorizontal: EXPAND_FILL,
        sizeFlagsStretchRatio: 3,
      }),
      solveNode('Split/RatioRight', 'Control', {
        layoutMode: 2,
        sizeFlagsHorizontal: EXPAND_FILL,
      }),
    ]);

    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([root], VIEWPORT, ctx);

    expect(solved.get('Split/RatioLeft')?.rect).toEqual({ x: 0, y: 0, w: 294, h: 60 });
    expect(solved.get('Split/RatioRight')?.rect).toEqual({ x: 306, y: 0, w: 94, h: 60 });
    // The CONTAINER's own SolvedControl carries the dragger position its
    // ContainerLayoutFn actually computed (ITEM A: a painter can read this
    // back instead of recomputing it from a narrower subset of the inputs)
    // — exactly where RatioLeft's rect ends, 294.
    expect(solved.get('Split')?.meta).toEqual({ draggerPos: 294 });
  });

  it('meta.draggerPos is undefined with fewer than two sortable children — nothing to report', () => {
    controlSolverRegistry.registerContainerLayout('HSplitContainer', makeSplitContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HSplitContainer', makeSplitContainerMinimumSize(false));

    const root = solveNode(
      'Split',
      'HSplitContainer',
      { layoutMode: 1, offsetLeft: 0, offsetTop: 0, offsetRight: 400, offsetBottom: 60 },
      [solveNode('Split/Only', 'Control', { layoutMode: 2 })]
    );

    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([root], VIEWPORT, ctx);

    expect(solved.get('Split')?.meta).toEqual({ draggerPos: undefined });
  });

  it('skips a hidden child and a third child alike, mirroring the DOM path\'s two-sortable-child cap', () => {
    controlSolverRegistry.registerContainerLayout('HSplitContainer', makeSplitContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HSplitContainer', makeSplitContainerMinimumSize(false));

    const root = solveNode('Split', 'HSplitContainer', {
      layoutMode: 1,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 400,
      offsetBottom: 60,
    }, [
      solveNode('Split/Hidden', 'Control', { layoutMode: 2, visible: false }),
      solveNode('Split/A', 'Control', { layoutMode: 2 }),
      solveNode('Split/B', 'Control', { layoutMode: 2 }),
      solveNode('Split/C', 'Control', { layoutMode: 2 }),
    ]);

    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([root], VIEWPORT, ctx);

    // A and B are the first two SORTABLE children (Hidden is skipped); with
    // neither expanding, A gets the "neither" rest position (0, floored to
    // its own zero minimum) and B gets the rest.
    expect(solved.get('Split/A')?.rect).toEqual({ x: 0, y: 0, w: 0, h: 60 });
    expect(solved.get('Split/B')?.rect).toEqual({ x: 12, y: 0, w: 388, h: 60 });
    // C never got a rect from the container at all — floored to zero by controlRectSolver.
    expect(solved.get('Split/C')?.rect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('reads the actual committed unit-split-container.tscn fixture end-to-end ("Both" row)', () => {
    controlSolverRegistry.registerContainerLayout('HSplitContainer', makeSplitContainerLayout(false));
    controlSolverRegistry.registerMinimumSize('HSplitContainer', makeSplitContainerMinimumSize(false));

    const content = readFileSync(resolve(fixturesDir(), 'unit-split-container.tscn'), 'utf8');
    const scene = new TscnParser().parse(content);

    function toSolveTree(nodes: readonly TscnNode[], parentPath: string): SolveNode[] {
      return nodes.map((n) => {
        const path = joinPath(parentPath, n.name);
        return { ...emptySolveNode(), path, node: n, children: toSolveTree(n.children, path) };
      });
    }

    const [rootNode] = scene.nodes;
    const tree = toSolveTree(rootNode ? [rootNode] : [], '');
    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree(tree, VIEWPORT, ctx);

    expect(solved.get('Root/Both/BothLeft')?.rect).toEqual({ x: 0, y: 0, w: 194, h: 60 });
    expect(solved.get('Root/Both/BothRight')?.rect).toEqual({ x: 206, y: 0, w: 194, h: 60 });
    expect(solved.get('Root/FirstOnly/FirstOnlyLeft')?.rect).toEqual({ x: 0, y: 0, w: 388, h: 60 });
    expect(solved.get('Root/FirstOnly/FirstOnlyRight')?.rect).toEqual({ x: 400, y: 0, w: 0, h: 60 });
    expect(solved.get('Root/Neither/NeitherLeft')?.rect).toEqual({ x: 0, y: 0, w: 120, h: 60 });
    expect(solved.get('Root/Neither/NeitherRight')?.rect).toEqual({ x: 132, y: 0, w: 268, h: 60 });
    expect(solved.get('Root/SepZero/SepZeroLeft')?.rect).toEqual({ x: 0, y: 0, w: 196, h: 60 });
    expect(solved.get('Root/SepZero/SepZeroRight')?.rect).toEqual({ x: 204, y: 0, w: 196, h: 60 });
    expect(solved.get('Root/DraggerCollapsed/DraggerCollapsedLeft')?.rect).toEqual({ x: 0, y: 0, w: 200, h: 60 });
    expect(solved.get('Root/DraggerCollapsed/DraggerCollapsedRight')?.rect).toEqual({ x: 200, y: 0, w: 200, h: 60 });
  });

  it('reads the actual committed unit-split-container-vertical.tscn fixture end-to-end', () => {
    controlSolverRegistry.registerContainerLayout('VSplitContainer', makeSplitContainerLayout(true));
    controlSolverRegistry.registerMinimumSize('VSplitContainer', makeSplitContainerMinimumSize(true));

    const content = readFileSync(resolve(fixturesDir(), 'unit-split-container-vertical.tscn'), 'utf8');
    const scene = new TscnParser().parse(content);

    function toSolveTree(nodes: readonly TscnNode[], parentPath: string): SolveNode[] {
      return nodes.map((n) => {
        const path = joinPath(parentPath, n.name);
        return { ...emptySolveNode(), path, node: n, children: toSolveTree(n.children, path) };
      });
    }

    const [rootNode] = scene.nodes;
    const tree = toSolveTree(rootNode ? [rootNode] : [], '');
    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree(tree, VIEWPORT, ctx);

    expect(solved.get('Root/Both/BothTop')?.rect).toEqual({ x: 0, y: 0, w: 120, h: 144 });
    expect(solved.get('Root/Both/BothBottom')?.rect).toEqual({ x: 0, y: 156, w: 120, h: 144 });
    expect(solved.get('Root/Offset/OffsetTop')?.rect).toEqual({ x: 0, y: 0, w: 120, h: 194 });
    expect(solved.get('Root/Offset/OffsetBottom')?.rect).toEqual({ x: 0, y: 206, w: 120, h: 94 });
  });
});

// --- The (int) narrowing SplitContainer applies before it does any arithmetic
// `_get_valid_range` casts the size and both minimums to int, and
// `get_minimum_size` accumulates via `minimum[axis] += (int)min_size[axis]`.
// Every text-derived minimum is fractional, so dropping the casts leaves a
// surviving fraction that moves a child rect by up to a pixel.
describe('computeSplitDraggerPosition — (int) narrowing of size and minimums', () => {
  it('truncates each child minimum on its own before clamping', () => {
    // lo = (int)10.9 = 10. Keeping the fraction would clamp up to 10.9.
    const pos = computeSplitDraggerPosition(
      400.7, 12, axisChild({ minSize: 10.9 }), axisChild({ minSize: 20.9 }), -1000, false
    );
    expect(pos).toBe(10);
  });

  it('truncates the size and the second minimum for the upper bound', () => {
    // hi = (int)400.7 - 12 - (int)20.9 = 400 - 12 - 20 = 368.
    const pos = computeSplitDraggerPosition(
      400.7, 12, axisChild({ minSize: 10.9 }), axisChild({ minSize: 20.9 }), 1000, false
    );
    expect(pos).toBe(368);
  });
});

describe('splitContainerMinimumSize — (int) accumulation', () => {
  it('truncates each child minimum before summing the main axis', () => {
    // 10.9 -> 10, 20.9 -> 20, + separation 12 = 42. Summing raw gives 43.8.
    const min = splitContainerMinimumSize(false, 12, [{ x: 10.9, y: 5.9 }, { x: 20.9, y: 7.9 }]);
    expect(min.x).toBe(42);
  });

  it('truncates the cross-axis maximum too', () => {
    const min = splitContainerMinimumSize(false, 12, [{ x: 10.9, y: 5.9 }, { x: 20.9, y: 7.9 }]);
    expect(min.y).toBe(7);
  });
});
