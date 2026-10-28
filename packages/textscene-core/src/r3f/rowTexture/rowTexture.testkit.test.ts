import { describe, expect, it } from 'vitest';
import { texelOfRow } from './rowTexture.testkit';

describe('texelOfRow', () => {
  it('reads the four floats of a texel of a row, rows `texelsPerRow` texels long', () => {
    const data = Float32Array.from({ length: 16 }, (_, i) => i);

    expect(texelOfRow(2)({ data, count: 2 }, 1, 1)).toEqual([12, 13, 14, 15]);
  });
});
