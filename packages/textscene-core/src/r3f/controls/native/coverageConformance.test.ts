/**
 * Conformance guard for the staged native-Control rollout, over the REAL
 * barrel-registered `ControlComponentRegistry`/`controlSolverRegistry` (the
 * side-effect import of `../index` registers every Control slice, DOM and
 * native alike — a hand-built stub registry would prove nothing about what
 * ships).
 *
 * Three independent completeness checks:
 *
 * 1. Native painter coverage — every registered Control type carries a
 *    `Native` painter. A missing one falls back to `<ControlFallback>`'s
 *    outline (`ControlCanvasWalker.tsx`) instead of failing loudly, so this
 *    is the one place a lost painter would otherwise regress silently.
 * 2. `TWO_D_UI_TYPES` (`has2DUIContent.ts`) mirrors the registry exactly, in
 *    BOTH directions (mirrors `has2DUIContent.driftguard.test.ts`).
 * 3. Solver-registry completeness: every real Container-family type has a
 *    `containerLayout` (and no other type does), and every registered type
 *    produces a rect from the real solve — through `solveControlTree`
 *    itself, not a re-derivation of what "produces a rect" means.
 */
import { describe, expect, it } from 'vitest';
// Side-effect import: registers all 23 Control slices' DOM + native painters,
// and every slice's solver functions (`nativeSolver.ts`/`index.r3f.ts`).
import { controlComponentRegistry } from '../index';
import { TWO_D_UI_TYPES } from '../has2DUIContent';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';
import { controlSolverRegistry } from './solverRegistry';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { nativeTheme } from './nativeTheme';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';

/**
 * The real Godot `Container` subclasses among the 23 registered types — the
 * ones whose CHILDREN a registered `ContainerLayoutFn` must position, per
 * `controlRectSolver.ts`'s `dispatchChildren`.
 *
 * `SubViewportContainer` is deliberately NOT in this set despite the name:
 * its only valid children are `SubViewport` nodes, which are not `Control`s
 * at all and never reach the generic Control solve (`buildSolveTree.ts` skips
 * a viewport boundary and its `NativeComponent.tsx` positions each
 * `SubViewport` itself via `stretch`/`stretch_shrink`, not `fit_child_in_rect`).
 * Registering a no-op `containerLayout` for it would be pure ceremony, not a
 * fix — confirmed against real Godot's own `SubViewportContainer`, which
 * likewise never calls `fit_child_in_rect` for its children.
 */
const CONTAINER_TYPES = new Set([
  'VBoxContainer',
  'HBoxContainer',
  'HSplitContainer',
  'VSplitContainer',
  'GridContainer',
  'CenterContainer',
  'MarginContainer',
  'ScrollContainer',
  'PanelContainer',
]);

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

/** A node of `type` carrying only what its own parser produces by default. */
function parseBareNode(type: string): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Probe" type="${type}"]\n`
  );
  return scene.nodes[0];
}

function bareSolveNode(type: string): SolveNode {
  const node = parseBareNode(type);
  return { path: node.name, node, children: [], styleBoxes: {}, textureSize: null };
}

/**
 * Every Control type Godot's 2D UI needs, and the only ones this renderer
 * claims. Deliberately an absolute number rather than something derived: every
 * other check here compares the registry against a list that moves WITH it, so
 * a slice deleted from both sides would leave all of them green. Adding or
 * removing a slice is always a deliberate act, so updating this is too.
 */
const REGISTERED_CONTROL_TYPES = 23;

describe('Native Control registry coverage', () => {
  it('registers every Control type the 2D UI needs', () => {
    expect(controlComponentRegistry.getAllTypeNames()).toHaveLength(REGISTERED_CONTROL_TYPES);
  });

  it('every registered Control type has a native painter', () => {
    const registered = controlComponentRegistry.getAllTypeNames();
    const missing = registered.filter((type) => controlComponentRegistry.getNative(type) === undefined);

    expect(
      missing,
      `${registered.length - missing.length}/${registered.length} registered types carry a Native painter`
    ).toEqual([]);
  });

  it('TWO_D_UI_TYPES exactly mirrors the registered Control component types', () => {
    const registered = new Set(controlComponentRegistry.getAllTypeNames());

    expect(new Set(TWO_D_UI_TYPES)).toEqual(registered);
  });
});

describe('Control solver-registry completeness', () => {
  it('every real Container-family type has a registered containerLayout', () => {
    const missing = [...CONTAINER_TYPES].filter(
      (type) => controlSolverRegistry.containerLayout(type) === undefined
    );

    expect(missing).toEqual([]);
  });

  it('no type outside the Container family has a registered containerLayout', () => {
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
