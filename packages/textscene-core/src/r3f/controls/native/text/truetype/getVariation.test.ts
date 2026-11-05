/** GETVARIATION pushes each normalised coordinate in 2.14 (`Ins_GETVARIATION`, ttinterp.c), all 0 at the default instance. */

import { describe, expect, it } from 'vitest';
import type { ExecContext } from './ttExecContext';
import { getVariation } from './ttStateInstructions';

/** Only the fields GETVARIATION reads: the face's axes, the stack and the failure. */
function contextAt(
  normalizedCoordinates: number[],
  stackSize = 16
): { exc: ExecContext; failures: string[] } {
  const failures: string[] = [];
  const exc = {
    face: {
      axisCount: normalizedCoordinates.length,
      normalizedCoordinates: Int32Array.from(normalizedCoordinates),
    },
    stack: new Float64Array(stackSize),
    top: 0,
    newTop: 0,
    fail: (error: string) => failures.push(error),
  } as unknown as ExecContext;
  return { exc, failures };
}

describe('getVariation', () => {
  it('pushes the 16.16 coordinate of each axis as 2.14', () => {
    const { exc } = contextAt([65536, -43692, 39319]);

    getVariation(exc, 0);

    expect([...exc.stack.slice(0, 3)]).toEqual([16384, -10923, 9829]);
    expect(exc.newTop).toBe(3);
  });

  it('pushes 0 for every axis at the default instance', () => {
    const { exc } = contextAt([0, 0]);

    getVariation(exc, 0);

    expect([...exc.stack.slice(0, 2)]).toEqual([0, 0]);
  });

  it('pushes nothing and fails with Stack_Overflow when the axes do not fit', () => {
    const { exc, failures } = contextAt([1, 2, 3], 2);

    getVariation(exc, 0);

    expect(failures).toEqual(['Stack_Overflow']);
    expect(exc.newTop).toBe(0);
  });
});
