import { describe, expect, it } from 'vitest';
import { multiMeshInstanceArrays } from './instanceBuffer';
import type { DrawnInstances } from './types';

const TRANSFORM_3D = 1;
const TRANSFORM_2D = 0;

function drawn(fields: Partial<DrawnInstances>): DrawnInstances {
  return {
    transformFormat: TRANSFORM_3D,
    usesColors: false,
    usesCustomData: false,
    count: 1,
    buffer: new Float32Array(0),
    ...fields,
  };
}

/** The column-major matrix of a half-size instance moved by `x` along x. */
function halfScaleMovedBy(x: number, zScale: number): number[] {
  return [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, zScale, 0, x, 0, 0, 1];
}

describe('multiMeshInstanceArrays: the transform', () => {
  it('turns the three rows of a 3D instance into a column-major matrix', () => {
    const buffer = new Float32Array([0.5, 0, 0, 3, 0, 0.5, 0, 0, 0, 0, 0.5, 0]);
    expect(Array.from(multiMeshInstanceArrays(drawn({ buffer })).matrices)).toEqual(halfScaleMovedBy(3, 0.5));
  });

  it('completes a 2D instance with the row (0, 0, 1, 0), so it draws in the XY plane', () => {
    const buffer = new Float32Array([0.5, 0, 0, 3, 0, 0.5, 0, 0]);
    const arrays = multiMeshInstanceArrays(drawn({ transformFormat: TRANSFORM_2D, buffer }));
    expect(Array.from(arrays.matrices)).toEqual(halfScaleMovedBy(3, 1));
  });

  it('keeps the shear of a row, so the matrix is the transpose of the rows', () => {
    const buffer = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(Array.from(multiMeshInstanceArrays(drawn({ buffer })).matrices)).toEqual([
      1, 5, 9, 0, 2, 6, 10, 0, 3, 7, 11, 0, 4, 8, 12, 1,
    ]);
  });

  it('draws the first `count` instances of the buffer', () => {
    const buffer = new Float32Array([...halfRows(1), ...halfRows(2), ...halfRows(3)]);
    expect(multiMeshInstanceArrays(drawn({ buffer, count: 2 })).matrices).toHaveLength(32);
  });

  it('draws nothing for a count of 0', () => {
    expect(multiMeshInstanceArrays(drawn({ buffer: new Float32Array(12), count: 0 })).matrices).toHaveLength(
      0
    );
  });

  it('draws an all-zero instance as a degenerate matrix, not as a skipped one', () => {
    const arrays = multiMeshInstanceArrays(drawn({ buffer: new Float32Array(12) }));
    expect(Array.from(arrays.matrices)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
});

function halfRows(x: number): number[] {
  return [0.5, 0, 0, x, 0, 0.5, 0, 0, 0, 0, 0.5, 0];
}

describe('multiMeshInstanceArrays: the colour and the custom data', () => {
  const COLOUR = [0.1, 0.2, 0.3, 0.4].map(Math.fround);
  const CUSTOM = [5, 6, 7, 8];

  it.each([
    ['neither', false, false, [], [], [1, 1, 1, 1], [0, 0, 0, 0]],
    ['the colour', true, false, COLOUR, [], COLOUR, [0, 0, 0, 0]],
    ['the custom data', false, true, [], CUSTOM, [1, 1, 1, 1], CUSTOM],
    ['both', true, true, COLOUR, CUSTOM, COLOUR, CUSTOM],
  ])(
    'reads %s at its offset',
    (_name, usesColors, usesCustomData, colour, custom, wantColour, wantCustom) => {
      const buffer = new Float32Array([...halfRows(0), ...colour, ...custom]);
      const arrays = multiMeshInstanceArrays(drawn({ buffer, usesColors, usesCustomData }));
      expect([Array.from(arrays.colours), Array.from(arrays.customs)]).toEqual([wantColour, wantCustom]);
    }
  );

  it('reads the colour at the 2D offset of 8 floats', () => {
    const buffer = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, ...COLOUR]);
    const arrays = multiMeshInstanceArrays(
      drawn({ transformFormat: TRANSFORM_2D, buffer, usesColors: true })
    );
    expect(Array.from(arrays.colours)).toEqual(COLOUR);
  });

  it('reads the second instance at one stride', () => {
    const buffer = new Float32Array([...halfRows(0), 0, 0, 0, 1, ...halfRows(1), ...COLOUR]);
    const arrays = multiMeshInstanceArrays(drawn({ buffer, usesColors: true, count: 2 }));
    expect(Array.from(arrays.colours.subarray(4))).toEqual(COLOUR);
  });
});
