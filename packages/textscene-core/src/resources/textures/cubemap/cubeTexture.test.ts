import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cubeTexture } from './cubeTexture';

/** Six 1x2 faces whose first byte names the face and whose rows count down the face. */
function sixFaces(): Uint8Array {
  return Uint8Array.from(
    { length: 6 * 2 * 4 },
    (_, index) => (Math.trunc(index / 8) + 1) * 10 + (Math.trunc(index / 4) % 2)
  );
}

const firstBytes = (texture: THREE.CubeTexture) =>
  (texture.image as THREE.DataTexture[]).map((face) => (face.image.data as Uint8Array)[0]);

describe('cubeTexture', () => {
  it('gives the layers to the faces in order, +X first', () => {
    const cube = cubeTexture({ texels: sixFaces(), width: 1, height: 2, depth: 6 }, false)!;
    expect(firstBytes(cube)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('keeps each face top row first, as Godot uploads a layer', () => {
    const cube = cubeTexture({ texels: sixFaces(), width: 1, height: 2, depth: 6 }, false)!;
    const face = (cube.image as THREE.DataTexture[])[0]!;
    expect([...(face.image.data as Uint8Array)].filter((_, index) => index % 4 === 0)).toEqual([10, 11]);
    expect(cube.flipY).toBe(false);
  });

  it('generates mipmaps only when the import does', () => {
    const texels = { texels: sixFaces(), width: 1, height: 2, depth: 6 };
    expect(cubeTexture(texels, true)!.generateMipmaps).toBe(true);
    expect(cubeTexture(texels, false)!.generateMipmaps).toBe(false);
  });

  it('builds no cube from layers other than six, which Godot refuses (error case)', () => {
    expect(cubeTexture({ texels: new Uint8Array(5 * 4), width: 1, height: 1, depth: 5 }, false)).toBeNull();
  });

  it('uploads float texels as half floats (edge case)', () => {
    const cube = cubeTexture({ texels: new Float32Array(6 * 4), width: 1, height: 1, depth: 6 }, false)!;
    expect(cube.type).toBe(THREE.HalfFloatType);
  });
});
