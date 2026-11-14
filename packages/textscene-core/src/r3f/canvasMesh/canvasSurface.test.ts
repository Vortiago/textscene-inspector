import { describe, expect, it } from 'vitest';
import { canvasSurfaceGeometry } from './canvasSurface';

const geometry = canvasSurfaceGeometry({
  positions: new Float32Array([10, 20, 30, 40]),
  uvs: new Float32Array([0, 0.25, 1, 1]),
  colors: new Float32Array([1, 0, 0, 0.5, 0, 1, 0, 1]),
  indices: [0, 1, 0],
});

describe('canvasSurfaceGeometry', () => {
  it("negates Godot's downward Y", () => {
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([10, -20, 0, 30, -40, 0]);
  });

  it('flips V for a bottom-up upload', () => {
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual([0, 0.75, 1, 0]);
  });

  it('keeps colours four wide, so an authored alpha draws', () => {
    expect(geometry.getAttribute('color').itemSize).toBe(4);
  });

  it('keeps the index', () => {
    expect(Array.from(geometry.getIndex()!.array)).toEqual([0, 1, 0]);
  });
});
