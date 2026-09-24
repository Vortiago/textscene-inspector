/**
 * `vSliderMinimumSize` registers `../shared/sliderSolver.ts`'s `sliderMinimumSize` at
 * `vertical = true`. `shared/sliderSolver.test.ts` proves the geometry. This pins only the
 * registration and the axis this slice supplies.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { vSliderMinimumSize } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(): SolveNode {
  return {
    ...solveNode(),
    path: 'S',
    node: { name: 'S', type: 'VSlider', children: [], properties: { name: 'S' } as ControlProperties },
  };
}

function ctx(): SolveContext {
  return { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
}

describe('vSliderMinimumSize', () => {
  it('registers under the "VSlider" type name', () => {
    expect(controlSolverRegistry.minimumSize('VSlider')).toBe(vSliderMinimumSize);
  });

  it('is (MAX(track, grabber), track) = (16, 8) at scale 1 — the VERTICAL axis', () => {
    expect(vSliderMinimumSize(node(), ctx())).toEqual({ x: 16, y: 8 });
  });
});
