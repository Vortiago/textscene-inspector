import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readImagePixels } from './withImageCanvas';

describe('readImagePixels', () => {
  it("reads a DataTexture's bytes as they are", () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    expect(readImagePixels({ data, width: 1, height: 1 })).toEqual({ data, width: 1, height: 1 });
  });

  it('reads half floats as their values clamped to bytes (edge case)', () => {
    const halves = new Uint16Array([0.5, 2, -1, 1].map((value) => THREE.DataUtils.toHalfFloat(value)));
    expect(Array.from(readImagePixels({ data: halves, width: 1, height: 1 })!.data)).toEqual([
      128, 255, 0, 255,
    ]);
  });

  it('reads nothing from an image without a size (error path)', () => {
    expect(readImagePixels({ data: new Uint8Array(4), width: 0, height: 0 })).toBeUndefined();
  });
});
