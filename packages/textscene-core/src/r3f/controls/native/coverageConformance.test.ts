/**
 * Conformance guard over the REAL barrel-registered
 * `ControlComponentRegistry`/`controlSolverRegistry` (the side-effect import
 * of `../index` registers every Control slice's native painter — a
 * hand-built stub registry would prove nothing about what ships).
 *
 * Two independent completeness checks:
 *
 * 1. Native painter coverage — every Control type the 2D UI needs carries a
 *    registered painter. A missing one falls back to `<ControlFallback>`'s
 *    outline (`ControlCanvasWalker.tsx`) instead of failing loudly, so this
 *    is the one place a lost painter would otherwise regress silently.
 * 2. Solver-registry completeness: exactly the Container-family types have a
 *    `containerLayout`, and every registered type produces a rect from the
 *    real solve — through `solveControlTree` itself, not a re-derivation of
 *    what "produces a rect" means.
 *
 * `TWO_D_UI_TYPES` mirroring the registry is NOT re-checked here:
 * `has2DUIContent.driftguard.test.ts` exists for exactly that and owns it.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Side-effect import: registers all 60 Control slices' native painters, and
// every slice's solver functions (`nativeSolver.ts`/`index.r3f.ts`).
import { controlComponentRegistry } from '../index';
import { parseBareNode } from '../testing/probeScene';
import { controlSolverRegistry } from './solverRegistry';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { nativeTheme } from './nativeTheme';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { solveNode } from './testing/solveNode';

/**
 * The real Godot `Container` subclasses among the 23 registered types — the
 * ones whose CHILDREN a registered `ContainerLayoutFn` must position, per
 * `controlRectSolver.ts`'s `dispatchChildren`.
 *
 * `SubViewportContainer` is deliberately NOT in this set despite the name:
 * its only valid children are `SubViewport` nodes, which are not `Control`s
 * at all and never reach the generic Control solve (`buildSolveTree.ts` skips
 * a viewport boundary and its `Component.tsx` positions each
 * `SubViewport` itself via `stretch`/`stretch_shrink`, not `fit_child_in_rect`).
 * Registering a no-op `containerLayout` for it would be pure ceremony, not a
 * fix — confirmed against real Godot's own `SubViewportContainer`, which
 * likewise never calls `fit_child_in_rect` for its children.
 */
const CONTAINER_TYPES = new Set([
  'VBoxContainer',
  'HBoxContainer',
  'BoxContainer',
  'HSplitContainer',
  'VSplitContainer',
  'SplitContainer',
  'GridContainer',
  'CenterContainer',
  'MarginContainer',
  'ScrollContainer',
  'PanelContainer',
  'AspectRatioContainer',
  'FlowContainer',
  'HFlowContainer',
  'VFlowContainer',
  // `Container` itself is NOT here: `container.cpp` has no
  // `NOTIFICATION_SORT_CHILDREN` arm, so a bare Container lays nothing out.
  'TabContainer',
  'FoldableContainer',
  'GraphElement',
  'GraphNode',
  'GraphFrame',
  // Places its children at their own `position_offset` through `scroll_offset`
  // and `zoom` rather than fitting them, but it is still the parent that
  // decides where they land.
  'GraphEdit',
]);

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function bareSolveNode(type: string): SolveNode {
  const node = parseBareNode(type);
  return { ...solveNode(), path: node.name, node };
}

/**
 * Every Control type Godot's 2D UI needs, and the only ones this renderer
 * claims: the 59 Control types `ClassDB.can_instantiate` accepts, plus
 * `CanvasLayer`, which is a `Node` rather than a Control but roots a 2D UI
 * subtree and so registers here alongside them.
 *
 * The six Control types NOT here cannot appear in a scene at all —
 * `ScrollBar`, `Separator`, `Slider` and the three `OpenXR*Editor*` classes are
 * registered abstract, and a GDScript cannot inherit from one either, so no
 * scripted node serialises under their names.
 *
 * Deliberately an absolute number rather than something derived: every other
 * check here compares the registry against a list that moves WITH it, so a
 * slice deleted from both sides would leave all of them green. Adding or
 * removing a slice is always a deliberate act, so updating this is too.
 */
const REGISTERED_CONTROL_TYPES = 60;

/**
 * A slice that writes a `TextureSlotsFn` and never registers it.
 *
 * Its own unit tests still pass — they call the function directly — while the
 * walker never asks for it, so `SolveNode.textureSlots` stays empty and the
 * widget neither sizes to its texture nor draws it. LineEdit shipped exactly
 * that: `right_icon` was parsed, measured, tested, and invisible.
 *
 * Read from the FILES rather than the registry, because the registry cannot
 * report a function nobody handed it.
 */
describe('every TextureSlotsFn a slice writes is registered', () => {
  it('leaves none of them unreachable from the walker', () => {
    const uiRoot = resolve(import.meta.dirname, '../../../nodes/2d/ui');
    const unregistered = readdirSync(uiRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => {
        const solver = join(uiRoot, e.name, 'nativeSolver.ts');
        if (!existsSync(solver)) return false;
        if (!readFileSync(solver, 'utf8').includes('TextureSlotsFn')) return false;
        return !readdirSync(join(uiRoot, e.name))
          .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
          .some((f) => readFileSync(join(uiRoot, e.name, f), 'utf8').includes('registerTextureSlots'));
      })
      .map((e) => e.name);

    expect(unregistered).toEqual([]);
  });
});

describe('Native Control registry coverage', () => {
  it('registers every Control type the 2D UI needs', () => {
    expect(controlComponentRegistry.getAllTypeNames()).toHaveLength(REGISTERED_CONTROL_TYPES);
  });

  it('every registered Control type has a native painter', () => {
    const registered = controlComponentRegistry.getAllTypeNames();
    const missing = registered.filter((type) => controlComponentRegistry.get(type) === undefined);

    expect(
      missing,
      `${registered.length - missing.length}/${registered.length} registered types carry a painter`
    ).toEqual([]);
  });

});

describe('Control solver-registry completeness', () => {
  it('exactly the Container-family types have a registered containerLayout', () => {
    const registeredWithLayout = controlComponentRegistry
      .getAllTypeNames()
      .filter((type) => controlSolverRegistry.containerLayout(type) !== undefined);

    expect(new Set(registeredWithLayout)).toEqual(CONTAINER_TYPES);
  });

  it('every registered type produces a finite rect from the real solve', () => {
    const failed: string[] = [];

    for (const type of controlComponentRegistry.getAllTypeNames()) {
      const root = bareSolveNode(type);
      const ctx = createSolveContext(THEME, null);
      const solved = solveControlTree([root], VIEWPORT, ctx);
      const entry = solved.get(root.path);
      const rect = entry?.rect;

      const isFiniteRect =
        !!rect &&
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.w) &&
        Number.isFinite(rect.h);

      if (!isFiniteRect) failed.push(type);
    }

    expect(failed).toEqual([]);
  });
});
