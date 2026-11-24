import { describe, expect, it } from 'vitest';
import { surfaceLayout } from './surfaceFormat';
import { attributeRecords } from './vertexBuffers';

const RGBA_FLOAT_CUSTOM0 = (1 << 0) | (1 << 6) | (7 << 13);

describe('attributeRecords', () => {
  it('reads one record of the format width for each vertex', () => {
    const records = attributeRecords(new Uint8Array(32), 2, surfaceLayout(RGBA_FLOAT_CUSTOM0), () => {});

    expect(records?.attributeStride).toBe(16);
  });

  it('reads no records from attribute_data narrower than the format, and reports the width (error case)', () => {
    const widths: number[] = [];

    const records = attributeRecords(new Uint8Array(8), 1, surfaceLayout(RGBA_FLOAT_CUSTOM0), (width) =>
      widths.push(width)
    );

    expect(records).toBeUndefined();
    expect(widths).toEqual([8]);
  });

  it('reads no records, and reports nothing, for a format with no attribute record (edge case)', () => {
    const widths: number[] = [];

    expect(
      attributeRecords(new Uint8Array(0), 3, surfaceLayout(1 << 0), (width) => widths.push(width))
    ).toBeUndefined();
    expect(widths).toEqual([]);
  });
});
