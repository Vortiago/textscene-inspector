import { describe, expect, it } from 'vitest';
import { AREA_TEXTURE_FETCH } from './areaTextureFetch';
import { scalarGlslFunction } from '../testing/glslScalar';

const lodAt = scalarGlslFunction(AREA_TEXTURE_FETCH, 'godotAreaTextureLod');

describe('godotAreaTextureLod', () => {
  it('reads mip 6.94, log base 3 of 2048, one metre from a 1×1 light', () => {
    expect(lodAt(1)).toBeCloseTo(6.9402, 3);
  });

  it('reads mip 2.75, a sharper one, a centimetre from a 1×1 light', () => {
    expect(lodAt(0.01)).toBeCloseTo(2.7484, 3);
  });
});
