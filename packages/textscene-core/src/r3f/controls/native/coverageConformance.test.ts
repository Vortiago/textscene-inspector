/**
 * Guards the real barrel-registered `ControlComponentRegistry` and
 * `controlSolverRegistry`: every Control type has a painter, only Container
 * types have a `containerLayout`, and every type solves to a finite rect.
 */
// A missing painter falls back to `<ControlFallback>`'s outline without an
// error, so this is the one place a lost painter shows.
// `has2DUIContent.driftguard.test.ts` owns the `TWO_D_UI_TYPES` mirror check.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Side-effect import: registers every Control slice's native painter and
// solver functions (`nativeSolver.ts`/`index.r3f.ts`).
import { controlComponentRegistry } from '../index';
import { parseBareNode } from '../testing/probeScene';
import { controlSolverRegistry } from './solverRegistry';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { nativeTheme } from './nativeTheme';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { solveNode } from './testing/solveNode';

/**
 * The registered Godot `Container` subclasses: the types whose children a
 * `ContainerLayoutFn` positions (`controlRectSolver.ts`'s `dispatchChildren`).
 */
// Not `SubViewportContainer`: its children are `SubViewport`s, which never reach
// the Control solve, and Godot never calls `fit_child_in_rect` for them either.
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
  // Not `Container` itself: `container.cpp` has no
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
 * The 59 Control types `ClassDB.can_instantiate` accepts, plus `CanvasLayer`
 * and `ParallaxBackground`, which each root a 2D UI subtree on their own canvas
 * (`canvas_item.cpp:246-252` stops the climb at either).
 */
// `ScrollBar`, `Separator`, `Slider` and the three `OpenXR*Editor*` classes are
// abstract, so no scene holds one. A number, not a derived list: every other
// check here moves with the registry, so a slice deleted from both sides passes.
const REGISTERED_CONTROL_TYPES = 61;

/**
 * A slice that writes a `TextureSlotsFn` and never registers it passes its own
 * unit tests, while the walker leaves `SolveNode.textureSlots` empty and the
 * widget neither sizes to its texture nor draws it.
 */
// Reads the files, not the registry: the registry cannot report a function nobody handed it.
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
