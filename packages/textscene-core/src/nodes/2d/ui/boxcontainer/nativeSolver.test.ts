/**
 * A `BoxContainer` must lay out identically to a fixed-axis sibling given the
 * same `vertical` and the same children — that IS the base/subclass
 * relationship (`box_container.h`'s `HBoxContainer()`/`VBoxContainer()` each
 * just call `BoxContainer(bool)`). Verified two ways: exact numbers derived
 * from `BoxContainer::_resort`/`get_minimum_size` (`box_container.cpp:41-235`,
 * `:238-271`), and a differential check against the REAL registered
 * HBoxContainer/VBoxContainer solvers.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import './nativeSolver';
import '../hboxcontainer/nativeSolver';
import '../vboxcontainer/nativeSolver';

const THEME = nativeTheme(1);

function child(path: string, minSize: { x: number; y: number }): SolveNode {
  const node: TscnNode = {
    name: path,
    type: 'Control',
    children: [],
    properties: { name: path, customMinimumSize: minSize },
  };
  return { ...solveNode(), path: `Box/${path}`, node };
}

function boxRoot(type: string, vertical: boolean | undefined, children: SolveNode[]): SolveNode {
  const properties: Record<string, unknown> = {
    name: 'Box',
    anchorLeft: 0,
    anchorTop: 0,
    anchorRight: 1,
    anchorBottom: 1,
  };
  if (vertical !== undefined) properties.vertical = vertical;
  const node: TscnNode = { name: 'Box', type, children: [], properties };
  return { ...solveNode(), path: 'Box', node, children };
}

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 100, h: 50 };

describe('BoxContainer native layout — exact numbers', () => {
  it('vertical: false (default) stacks children left to right, separation 4', () => {
    const c0 = child('A', { x: 20, y: 10 });
    const c1 = child('B', { x: 30, y: 15 });
    const root = boxRoot('BoxContainer', undefined, [c0, c1]);
    const ctx = createSolveContext(THEME);
    const solved = solveControlTree([root], VIEWPORT, ctx);

    // box_container.cpp:181-235 — neither child stretches (SIZE_FILL only, no
    // SIZE_EXPAND), so each takes its own minimum on the main axis and the
    // full cross axis (fit_child_in_rect only shrinks when FILL is absent).
    expect(solved.get('Box/A')?.rect).toEqual({ x: 0, y: 0, w: 20, h: 50 });
    expect(solved.get('Box/B')?.rect).toEqual({ x: 24, y: 0, w: 30, h: 50 });
  });

  it('vertical: true stacks children top to bottom, separation 4', () => {
    const c0 = child('A', { x: 20, y: 10 });
    const c1 = child('B', { x: 30, y: 15 });
    const root = boxRoot('BoxContainer', true, [c0, c1]);
    const ctx = createSolveContext(THEME);
    const solved = solveControlTree([root], VIEWPORT, ctx);

    expect(solved.get('Box/A')?.rect).toEqual({ x: 0, y: 0, w: 100, h: 10 });
    expect(solved.get('Box/B')?.rect).toEqual({ x: 0, y: 14, w: 100, h: 15 });
  });

  it('BoxContainer::get_minimum_size (box_container.cpp:238-271) — main axis sums plus one separation', () => {
    // Two contexts: the minimum-size cache is keyed by PATH, and both roots
    // reuse path 'Box' — sharing one context would return the FIRST call's
    // cached answer for the second (see the sibling-comparison tests' own
    // note for the same hazard).
    const rootH = boxRoot('BoxContainer', false, [child('A', { x: 20, y: 10 }), child('B', { x: 30, y: 15 })]);
    const rootV = boxRoot('BoxContainer', true, [child('A', { x: 20, y: 10 }), child('B', { x: 30, y: 15 })]);
    expect(createSolveContext(THEME).combinedMinimumSize(rootH)).toEqual({ x: 20 + 4 + 30, y: 15 });
    expect(createSolveContext(THEME).combinedMinimumSize(rootV)).toEqual({ x: 30, y: 10 + 4 + 15 });
  });
});

describe('BoxContainer at vertical=X matches its fixed-axis sibling', () => {
  it('vertical=true produces the SAME child rects as VBoxContainer given the same children', () => {
    // Separate contexts: `createSolveContext`'s minimum-size cache is keyed by
    // PATH alone, and both trees reuse path 'Box/A'/'Box/B' on purpose (same
    // children) — sharing one context would let the second solve silently
    // read back the first's cached values instead of genuinely recomputing.
    const boxKids = [child('A', { x: 20, y: 10 }), child('B', { x: 30, y: 15 })];
    const vboxKids = [child('A', { x: 20, y: 10 }), child('B', { x: 30, y: 15 })];
    const boxSolved = solveControlTree([boxRoot('BoxContainer', true, boxKids)], VIEWPORT, createSolveContext(THEME));
    const vboxSolved = solveControlTree(
      [boxRoot('VBoxContainer', undefined, vboxKids)],
      VIEWPORT,
      createSolveContext(THEME)
    );

    expect(boxSolved.get('Box/A')?.rect).toEqual(vboxSolved.get('Box/A')?.rect);
    expect(boxSolved.get('Box/B')?.rect).toEqual(vboxSolved.get('Box/B')?.rect);
  });

  it('vertical=false (or absent) produces the SAME child rects as HBoxContainer given the same children', () => {
    const boxKids = [child('A', { x: 20, y: 10 }), child('B', { x: 30, y: 15 })];
    const hboxKids = [child('A', { x: 20, y: 10 }), child('B', { x: 30, y: 15 })];
    const boxSolved = solveControlTree(
      [boxRoot('BoxContainer', undefined, boxKids)],
      VIEWPORT,
      createSolveContext(THEME)
    );
    const hboxSolved = solveControlTree(
      [boxRoot('HBoxContainer', undefined, hboxKids)],
      VIEWPORT,
      createSolveContext(THEME)
    );

    expect(boxSolved.get('Box/A')?.rect).toEqual(hboxSolved.get('Box/A')?.rect);
    expect(boxSolved.get('Box/B')?.rect).toEqual(hboxSolved.get('Box/B')?.rect);
  });
});

describe('BoxContainer registration', () => {
  it('registers a container layout and a minimum size function', () => {
    expect(controlSolverRegistry.containerLayout('BoxContainer')).toBeDefined();
    expect(controlSolverRegistry.minimumSize('BoxContainer')).toBeDefined();
  });

  it('with no children lays out nothing and contributes a zero minimum size', () => {
    const root = boxRoot('BoxContainer', true, []);
    const ctx = createSolveContext(THEME);
    const solved = solveControlTree([root], VIEWPORT, ctx);
    expect(solved.get('Box')?.rect).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(ctx.combinedMinimumSize(root)).toEqual({ x: 0, y: 0 });
  });
});
