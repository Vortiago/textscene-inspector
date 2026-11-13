/**
 * Importing `index.r3f` registers Label's painter and rect solver (ADR-0001).
 * The size-dependent declaration matters most: `solveControlTree` asks
 * `readsTentativeRect` per node, so without it an autowrapping Label falls
 * back to one line, while `nativeSolver.test.ts`, which registers it itself, stays green.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
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
    expect(
      controlSolverRegistry.readsTentativeRect({ node: { type: 'Label' } } as unknown as SolveNode)
    ).toBe(true);
  });

  it('registers no container layout — a Label has no Control children to place', () => {
    expect(controlSolverRegistry.containerLayout('Label')).toBeUndefined();
  });
});
