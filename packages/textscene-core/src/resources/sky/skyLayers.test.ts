import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  LAST_LAYER_FACE_SIZE,
  ROUGH_LAYER_FACE_SIZES,
  readCubeRadiance,
  skyLayers,
  type SkyLayers,
} from './skyLayers';

const SIZE = 8;

/** Six RGBA faces, each filled with the radiance `radiance` gives its index. */
function cube(radiance: (face: number) => number): Float32Array[] {
  return Array.from({ length: 6 }, (_, face) => new Float32Array(SIZE * SIZE * 4).fill(radiance(face)));
}

const CENTRE = LAST_LAYER_FACE_SIZE / 2;
const LAST = LAST_LAYER_FACE_SIZE - 1;

/** The red channel of the last layer's texel at `col`, `row` of `face`. */
function ambientAt(layers: SkyLayers, face: number, col: number, row: number): number {
  return THREE.DataUtils.fromHalfFloat(layers.last[face]![(row * LAST_LAYER_FACE_SIZE + col) * 4]!);
}

describe('skyLayers', () => {
  it('bakes each rough layer at half the size of the one before, as a mip chain', () => {
    const layers = skyLayers(
      cube(() => 0.5),
      SIZE
    );
    expect(layers.rough.map((faces) => faces[0]!.length)).toEqual([32 * 32 * 4, 16 * 16 * 4, 8 * 8 * 4]);
    expect(layers.last[0]).toHaveLength(LAST_LAYER_FACE_SIZE * LAST_LAYER_FACE_SIZE * 4);
  });

  it('gives a uniform sky its own radiance in every direction of the last layer', () => {
    const layers = skyLayers(
      cube(() => 0.5),
      SIZE
    );
    for (const [face, col, row] of [
      [0, CENTRE, CENTRE],
      [3, 0, 0],
      [5, LAST, 2],
    ] as const) {
      expect(ambientAt(layers, face, col, row)).toBeCloseTo(0.5, 3);
    }
  });

  it.each([0, 1, 2, 3, 4, 5])('lights the side cube face %i faces more than its opposite', (face) => {
    const layers = skyLayers(
      cube((f) => (f === face ? 1 : 0)),
      SIZE
    );
    const opposite = face ^ 1;
    expect(ambientAt(layers, face, CENTRE, CENTRE)).toBeGreaterThan(0.4);
    expect(ambientAt(layers, opposite, CENTRE, CENTRE)).toBeLessThan(0.05);
  });

  it('keeps a lit face sharper in the first layer than in the last', () => {
    const layers = skyLayers(
      cube((f) => (f === 2 ? 1 : 0)),
      SIZE
    );
    const firstSize = ROUGH_LAYER_FACE_SIZES[0]!;
    const firstCentre = THREE.DataUtils.fromHalfFloat(
      layers.rough[0]![2]![((firstSize / 2) * firstSize + firstSize / 2) * 4]!
    );
    expect(firstCentre).toBeGreaterThan(ambientAt(layers, 2, CENTRE, CENTRE));
  });

  it('puts the up direction in the first texel row of the +X face, as WebGL samples it', () => {
    const layers = skyLayers(
      cube((f) => (f === 2 ? 1 : 0)),
      SIZE
    );
    expect(ambientAt(layers, 0, CENTRE, 0)).toBeGreaterThan(ambientAt(layers, 0, CENTRE, LAST));
  });

  it('refuses a cube without six faces', () => {
    expect(() => skyLayers(cube(() => 1).slice(1), SIZE)).toThrow('expected 6 cube faces, got 5');
  });

  it('refuses a face whose length is not the face size squared in RGBA', () => {
    const faces = cube(() => 1);
    faces[3] = new Float32Array(4);
    expect(() => skyLayers(faces, SIZE)).toThrow(
      `expected 6 RGBA faces of ${SIZE}x${SIZE}, got face 3 with 4 values`
    );
  });
});

describe('readCubeRadiance', () => {
  it('reads each face of a half-float cube as floats', () => {
    const target = new THREE.WebGLCubeRenderTarget(2, { type: THREE.HalfFloatType });
    const faces: number[] = [];
    const gl = {
      readRenderTargetPixels: vi.fn((_target, _x, _y, _w, _h, buffer: Uint16Array, face: number) => {
        faces.push(face);
        buffer.fill(THREE.DataUtils.toHalfFloat(face + 0.5));
      }),
    } as unknown as THREE.WebGLRenderer;

    const radiance = readCubeRadiance(gl, target);

    expect(faces).toEqual([0, 1, 2, 3, 4, 5]);
    expect(radiance.map((face) => face[0])).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5]);
    expect(radiance[0]).toHaveLength(2 * 2 * 4);
  });
});
