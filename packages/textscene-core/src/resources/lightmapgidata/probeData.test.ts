import { describe, expect, it } from 'vitest';
import { missingProbeDataField } from './probeData';

const PROBE_DATA =
  '{ "bounds": AABB(0, 0, 0, 1, 1, 1), "points": PackedVector3Array(), "tetrahedra": PackedInt32Array(), "bsp": PackedInt32Array(), "sh": PackedColorArray(), "interior": false, "baked_exposure": 1.0 }';

describe('missingProbeDataField', () => {
  it('finds none in a dictionary with every required field', () => {
    expect(missingProbeDataField(PROBE_DATA)).toBeNull();
  });

  it('names the first field the dictionary lacks', () => {
    expect(missingProbeDataField(PROBE_DATA.replace('"sh": PackedColorArray(), ', ''))).toBe('sh');
  });

  it('reads a field name only as a key, not inside another value (edge case)', () => {
    expect(missingProbeDataField(PROBE_DATA.replace('"bsp":', '"x": "bsp",'))).toBe('bsp');
  });
});
