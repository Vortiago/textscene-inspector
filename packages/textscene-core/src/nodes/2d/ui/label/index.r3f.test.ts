/**
 * Label self-registration: importing `index.r3f` must wire the native (WebGL
 * canvas) painter and the native rect solver into their respective registries —
 * the whole point of the self-registration convention (ADR-0001) is that
 * nothing else has to.
 *
 * The size-dependent declaration is the load-bearing one and the reason this
 * file exists at all. `solveControlTree` decides whether to run its second
 * solve pass by asking `controlSolverRegistry.isSizeDependentMinimum` about
 * each node's TYPE during `assignPaintIndex`, never by inspecting the
 * registered function. So an autowrapping Label's height would silently revert
 * to its unwrapped one-line substitute if this single line went missing —
 * `nativeSolver.test.ts` registers the declaration itself and would stay green
 * throughout.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Label } from './Component';
import { labelMinimumSize } from './nativeSolver';

describe('Label index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('Label')).toBe(Label);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('Label')).toBe(labelMinimumSize);
  });

  it("declares Label size-dependent, so a tree containing one gets solveControlTree's second pass", () => {
    expect(controlSolverRegistry.isSizeDependentMinimum('Label')).toBe(true);
  });

  it('registers no container layout — a Label has no Control children to place', () => {
    expect(controlSolverRegistry.containerLayout('Label')).toBeUndefined();
  });
});
