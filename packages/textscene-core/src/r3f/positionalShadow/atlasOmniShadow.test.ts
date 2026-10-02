import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AtlasOmniShadow } from './atlasOmniShadow';
import { holdPositionalShadowAtlas } from './shadowAtlasTarget';

// The tests read the atlas at the root viewport's size.
holdPositionalShadowAtlas({}, 4096);

/** An omni light at (1, 2, 3), turned a quarter about Y and scaled, as a node's transform can. */
function turnedLight(): THREE.PointLight {
  const light = new THREE.PointLight();
  light.position.set(1, 2, 3);
  light.rotation.y = Math.PI / 2;
  light.scale.setScalar(2);
  light.updateMatrixWorld();
  return light;
}

describe('AtlasOmniShadow.fitCube', () => {
  it('gives the shadow a cube whose depth the copy can read texel by texel', () => {
    const shadow = new AtlasOmniShadow();
    shadow.fitCube(512);
    const cube = shadow.map as THREE.WebGLCubeRenderTarget;
    expect(cube).toBeInstanceOf(THREE.WebGLCubeRenderTarget);
    expect(cube.width).toBe(512);
    expect(shadow.mapSize.toArray()).toEqual([512, 512]);
    const depth = cube.depthTexture!;
    expect(depth.compareFunction).toBeNull();
    expect([depth.minFilter, depth.magFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });

  it('keeps a cube of the size (edge case)', () => {
    const shadow = new AtlasOmniShadow();
    shadow.fitCube(256);
    const cube = shadow.map;
    shadow.fitCube(256);
    expect(shadow.map).toBe(cube);
  });

  it('replaces a cube three built, which compares and so reads no depth (error case)', () => {
    const shadow = new AtlasOmniShadow();
    const threeCube = new THREE.WebGLCubeRenderTarget(256);
    threeCube.depthTexture = new THREE.DepthTexture(256, 256);
    threeCube.depthTexture.compareFunction = THREE.LessEqualCompare;
    const dispose = vi.spyOn(threeCube, 'dispose');
    shadow.map = threeCube;
    shadow.fitCube(256);
    expect(shadow.map).not.toBe(threeCube);
    expect(dispose).toHaveBeenCalledOnce();
  });
});

describe('AtlasOmniShadow.writeLookupMatrix', () => {
  it('maps the world into the light’s own space, without its scale', () => {
    const light = turnedLight();
    const shadow = new AtlasOmniShadow();
    shadow.writeLookupMatrix(light);
    // One unit along the light's local +Z lies one unit along the world's +X.
    const local = new THREE.Vector3(2, 2, 3).applyMatrix4(shadow.matrix);
    expect(local.x).toBeCloseTo(0, 12);
    expect(local.y).toBeCloseTo(0, 12);
    expect(local.z).toBeCloseTo(1, 12);
  });

  it('keeps the slot in the bottom row, in units of the atlas', () => {
    const shadow = new AtlasOmniShadow();
    shadow.slot = { x: 2048, y: 1024, size: 512, paraboloidStep: [1, 0] };
    shadow.writeLookupMatrix(turnedLight());
    const e = shadow.matrix.elements;
    expect([e[3], e[7], e[11], e[15]]).toEqual([0.5, 0.25, 0.125, 0]);
  });

  it('steps to the next row for a pair that wraps (edge case)', () => {
    const shadow = new AtlasOmniShadow();
    shadow.slot = { x: 1024, y: 0, size: 1024, paraboloidStep: [-1, 1] };
    shadow.writeLookupMatrix(turnedLight());
    const e = shadow.matrix.elements;
    expect([e[11], e[15]]).toEqual([-0.25, 0.25]);
  });

  it('writes no slot for a light without one (error case)', () => {
    const shadow = new AtlasOmniShadow();
    shadow.writeLookupMatrix(turnedLight());
    const e = shadow.matrix.elements;
    expect([e[3], e[7], e[11], e[15]]).toEqual([0, 0, 0, 1]);
  });
});

describe('AtlasOmniShadow.dispose', () => {
  it('frees the cube', () => {
    const shadow = new AtlasOmniShadow();
    shadow.fitCube(128);
    const dispose = vi.spyOn(shadow.map!, 'dispose');
    shadow.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(shadow.map).toBeNull();
  });

  it('frees nothing for a shadow that never drew (edge case)', () => {
    expect(() => new AtlasOmniShadow().dispose()).not.toThrow();
  });
});
