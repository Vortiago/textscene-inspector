import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { unwrapInput } from './unwrapInput';
import { demoMeshSurfaces } from './testing/globalIllumination';

const UNIT_SCALE = { scale: [1, 1, 1], vertexScale: 1 } as const;
const DEMO_TEXEL_SIZE = 0.2;

function triangle(positions: number[], withNormals = true): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (withNormals)
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  return geometry;
}

describe('unwrapInput', () => {
  it("hashes the cube's input to the hash of its cache entry", async () => {
    const input = unwrapInput(await demoMeshSurfaces('cube.glb'), UNIT_SCALE, DEMO_TEXEL_SIZE);

    expect(input?.hash).toBe('9dfd97298732aae2cf6bb87e6dc2050f');
  });

  it("hashes zdm2's input to the hash of its cache entry", async () => {
    const input = unwrapInput(await demoMeshSurfaces('zdm2.glb'), UNIT_SCALE, DEMO_TEXEL_SIZE);

    expect(input?.hash).toBe('cf16ea077fd688f35e8b687b5ae52383');
  });

  it('hashes a -0 coordinate as +0, as the transform adds its zero origin (edge case)', () => {
    const negativeZero = unwrapInput([triangle([-0, -0, -0, 1, 0, 0, 0, 1, 0])], UNIT_SCALE, DEMO_TEXEL_SIZE);
    const positiveZero = unwrapInput([triangle([0, 0, 0, 1, 0, 0, 0, 1, 0])], UNIT_SCALE, DEMO_TEXEL_SIZE);

    expect(negativeZero?.hash).toBe(positiveZero?.hash);
  });

  it('leaves a last surface without normals out of the hash', () => {
    const lit = triangle([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const bare = triangle([5, 0, 0, 6, 0, 0, 5, 1, 0], false);

    expect(unwrapInput([lit, bare], UNIT_SCALE, DEMO_TEXEL_SIZE)).toMatchObject({
      hash: unwrapInput([lit], UNIT_SCALE, DEMO_TEXEL_SIZE)!.hash,
      surfaceCount: 1,
    });
  });

  it("gives no input when a surface without normals precedes one with them, which crashes Godot's import", () => {
    const bare = triangle([5, 0, 0, 6, 0, 0, 5, 1, 0], false);
    const lit = triangle([0, 0, 0, 1, 0, 0, 0, 1, 0]);

    expect(unwrapInput([bare, lit], UNIT_SCALE, DEMO_TEXEL_SIZE)).toBeNull();
  });

  it('gives no input when no surface has normals, as xatlas gets no area (edge case)', () => {
    expect(
      unwrapInput([triangle([0, 0, 0, 1, 0, 0, 0, 1, 0], false)], UNIT_SCALE, DEMO_TEXEL_SIZE)
    ).toBeNull();
  });
});
