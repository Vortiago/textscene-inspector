/**
 * `hSliderMinimumSize` registers `../shared/sliderSolver.ts`'s
 * `sliderMinimumSize` at `vertical = false`. The geometry itself is proved
 * once in `shared/sliderSolver.test.ts`; this only pins the registration and
 * the axis this slice supplies.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { hSliderMinimumSize } from './nativeSolver';

function node(): SolveNode {
  return {
    path: 'S',
    node: { name: 'S', type: 'HSlider', children: [], properties: { name: 'S' } as ControlProperties },
    children: [],
    styleBoxes: {},
    textureSize: null,
    fontOverrides: {},
    themeChain: [],
    projectTheme: null,
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
