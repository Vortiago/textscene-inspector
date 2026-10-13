import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SKY_LAYER_GROUPS, readCubeRadiance, skyLayers, type SkyLayers } from './skyLayers';
import type { RadianceFilter } from './types';

const SIZE = 8;

/** Six RGBA faces, each filled with the radiance `radiance` gives its index. */
function cube(radiance: (face: number) => number): Float32Array[] {
  return Array.from({ length: 6 }, (_, face) => new Float32Array(SIZE * SIZE * 4).fill(radiance(face)));
}

const [LAST_SIZE] = SKY_LAYER_GROUPS.last.faceSizes;
const CENTRE = LAST_SIZE / 2;
const LAST = LAST_SIZE - 1;

/** The red channel of the last layer's texel at `col`, `row` of `face`. */
function ambientAt(layers: SkyLayers, face: number, col: number, row: number): number {
  return THREE.DataUtils.fromHalfFloat(layers.last[0]![face]![(row * LAST_SIZE + col) * 4]!);
}

/** The red channel at the centre of `face` of one layer's faces. */
function centreOf(faces: readonly Uint16Array[], face: number): number {
  const size = Math.sqrt(faces[face]!.length / 4);
  return THREE.DataUtils.fromHalfFloat(faces[face]![((size / 2) * size + size / 2) * 4]!);
}

/** The +Y face lit, every other face dark. */
const LIT_UP = cube((f) => (f === 2 ? 1 : 0));

describe.each<RadianceFilter>(['importance-sample', 'fast'])('skyLayers with the %s filter', (filter) => {
  // Baked once: a bake takes about a second here, and no test changes what it returns.
  const uniform = skyLayers(
    cube(() => 0.5),
    SIZE,
    filter
  );
  const litUp = skyLayers(LIT_UP, SIZE, filter);

  it('bakes each group at its face sizes, as a mip chain', () => {
    for (const group of ['sharp', 'rough', 'last'] as const) {
      const sizes = SKY_LAYER_GROUPS[group].faceSizes;
      expect(uniform[group].map((faces) => faces[0]!.length)).toEqual(sizes.map((size) => size * size * 4));
    }
  });

  it('gives a uniform sky its own radiance in every direction of every layer', () => {
    for (const [face, col, row] of [
      [0, CENTRE, CENTRE],
      [3, 0, 0],
      [5, LAST, 2],
    ] as const) {
      expect(ambientAt(uniform, face, col, row)).toBeCloseTo(0.5, 3);
    }
    expect(centreOf(uniform.sharp[0]!, 4)).toBeCloseTo(0.5, 3);
  });

  it.each([0, 1, 2, 3, 4, 5])('lights the side cube face %i faces more than its opposite', (face) => {
    const layers = skyLayers(
      cube((f) => (f === face ? 1 : 0)),
      SIZE,
      filter
    );
    expect(ambientAt(layers, face, CENTRE, CENTRE)).toBeGreaterThan(0.4);
    expect(ambientAt(layers, face ^ 1, CENTRE, CENTRE)).toBeLessThan(0.05);
  });

  it('keeps a lit face sharper in each layer from 1 to 6 than in the next', () => {
    const centres = [...litUp.sharp, ...litUp.rough].map((faces) => centreOf(faces, 2));
    centres.slice(1).forEach((centre, index) => expect(centre).toBeLessThanOrEqual(centres[index]!));
    expect(centres[0]).toBeGreaterThan(centreOf(litUp.last[0]!, 2));
  });

  it('keeps the first layer close to the radiance, as its lobe is narrower than a texel of the chain', () => {
    expect(centreOf(litUp.sharp[0]!, 2)).toBeGreaterThan(0.95);
  });

  it('puts the up direction in the first texel row of the +X face, as WebGL samples it', () => {
    expect(ambientAt(litUp, 0, CENTRE, 0)).toBeGreaterThan(ambientAt(litUp, 0, CENTRE, LAST));
  });
});

describe('skyLayers', () => {
  it('refuses a cube without six faces', () => {
    expect(() => skyLayers(cube(() => 1).slice(1), SIZE, 'importance-sample')).toThrow(
      'expected 6 cube faces, got 5'
    );
  });

  it('refuses a face whose length is not the face size squared in RGBA', () => {
    const faces = cube(() => 1);
    faces[3] = new Float32Array(4);
    expect(() => skyLayers(faces, SIZE, 'importance-sample')).toThrow(
      `expected 6 RGBA faces of ${SIZE}x${SIZE}, got face 3 with 4 values`
    );
  });

  it('reads layer 6 for the last layer of a real-time sky, the roughest it has', () => {
    const layers = skyLayers(LIT_UP, SIZE, 'fast');
    expect(centreOf(layers.last[0]!, 2)).toBeCloseTo(centreOf(layers.rough.at(-1)!, 2), 2);
  });

  it('keeps a lit face brighter in the ambient of a real-time sky, as layer 6 is sharper than 7', () => {
    expect(ambientAt(skyLayers(LIT_UP, SIZE, 'fast'), 2, CENTRE, CENTRE)).toBeGreaterThan(
      ambientAt(skyLayers(LIT_UP, SIZE, 'importance-sample'), 2, CENTRE, CENTRE)
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
