import { describe, expect, it } from 'vitest';
import { CSG_MERGE_TOLERANCE } from './csg';

describe('CSG_MERGE_TOLERANCE', () => {
  it('is twice the single-precision epsilon', () => {
    expect(CSG_MERGE_TOLERANCE).toBeCloseTo(2.384185791015625e-7, 20);
  });

  it('is far wider than the trig residue three leaves at a pole', () => {
    expect(Math.abs(Math.sin(Math.PI) * 0.4)).toBeLessThan(CSG_MERGE_TOLERANCE);
  });
});
