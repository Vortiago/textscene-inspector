import { describe, expect, it } from 'vitest';
import { ArrayCustomFormat } from '../../../godot/rendering/meshArrayFormat';
import { surfaceLayout } from './surfaceFormat';

const VERTEX = 1 << 0;
const COLOR = 1 << 3;
const CUSTOM0 = 1 << 6;
const CUSTOM2 = 1 << 8;
const BONES_AND_WEIGHTS = (1 << 10) | (1 << 11);
const USE_8_BONE_WEIGHTS = 1 << 27;

function customFormat(custom: number, format: number): number {
  return format * 2 ** (13 + custom * 3);
}

describe('surfaceLayout', () => {
  it('places each custom array after the colour and the arrays before it', () => {
    const format = VERTEX | COLOR | CUSTOM0 | CUSTOM2 | customFormat(0, ArrayCustomFormat.RGB_FLOAT);

    const layout = surfaceLayout(format + customFormat(2, ArrayCustomFormat.RG_HALF));

    expect(layout.customs).toEqual([
      { format: ArrayCustomFormat.RGB_FLOAT, offset: 4 },
      undefined,
      { format: ArrayCustomFormat.RG_HALF, offset: 16 },
      undefined,
    ]);
    expect(layout.attributeStride).toBe(20);
  });

  it('reads four bones and weights a vertex, 16 bytes a record', () => {
    expect(surfaceLayout(VERTEX | BONES_AND_WEIGHTS).skin).toEqual({ count: 4, stride: 16 });
  });

  it('reads eight bones and weights a vertex under the 8-weight flag, 32 bytes a record', () => {
    expect(surfaceLayout(VERTEX | BONES_AND_WEIGHTS | USE_8_BONE_WEIGHTS).skin).toEqual({
      count: 8,
      stride: 32,
    });
  });

  it('reads no skin from bones without weights (edge case)', () => {
    expect(surfaceLayout(VERTEX | (1 << 10)).skin).toBeUndefined();
  });
});
