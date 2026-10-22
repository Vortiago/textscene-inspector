import { describe, expect, it } from 'vitest';
import { DataUtils } from 'three';
import { dfgHalfFloats } from './dfg';
import { DFG_SIZE } from './dfgTable.generated';

const table = dfgHalfFloats();

/** The `[fresnel, total]` pair at a texel. */
function entry(roughnessRow: number, nDotVColumn: number): [number, number] {
  const at = (roughnessRow * DFG_SIZE + nDotVColumn) * 2;
  return [DataUtils.fromHalfFloat(table[at]!), DataUtils.fromHalfFloat(table[at + 1]!)];
}

describe('dfgHalfFloats', () => {
  it('holds a pair per texel of the 128 by 128 table', () => {
    expect(table).toHaveLength(DFG_SIZE * DFG_SIZE * 2);
  });

  it('reflects everything, with no Fresnel gain, from a smooth surface seen head on', () => {
    const [fresnel, total] = entry(0, DFG_SIZE - 1);

    expect(fresnel).toBeCloseTo(0, 3);
    expect(total).toBeCloseTo(1, 2);
  });

  it('turns most of a smooth grazing reflection into Fresnel gain (edge case)', () => {
    const [fresnel, total] = entry(0, 0);

    expect(fresnel / total).toBeGreaterThan(0.9);
  });

  it('loses light to a rough surface, as one bounce sees less of it', () => {
    expect(entry(DFG_SIZE - 1, DFG_SIZE - 1)[1]).toBeLessThan(entry(0, DFG_SIZE - 1)[1]);
  });
});
