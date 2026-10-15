/**
 * `hSliderMinimumSize` registers `sliderMinimumSize` at `vertical = false`.
 * `shared/sliderSolver.test.ts` owns the geometry; this pins the registration and the axis.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import './nativeSolver';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const hSliderMinimumSize = controlSolverRegistry.minimumSize('HSlider')!;

function node(): SolveNode {
  return {
    ...solveNode(),
    path: 'S',
    node: controlNode('S', 'HSlider', { name: 'S' }),
  };
}

function ctx(): SolveContext {
  return { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
}

describe('hSliderMinimumSize', () => {
  it('registers under the "HSlider" type name', () => {
    expect(controlSolverRegistry.minimumSize('HSlider')).toBe(hSliderMinimumSize);
  });

  it('is (track, MAX(track, grabber)) = (8, 16) at scale 1 — the HORIZONTAL axis', () => {
    expect(hSliderMinimumSize(node(), ctx())).toEqual({ x: 8, y: 16 });
  });
});
