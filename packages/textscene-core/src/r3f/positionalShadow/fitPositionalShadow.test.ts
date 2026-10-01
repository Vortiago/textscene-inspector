import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { fitPositionalShadow, resizeShadowMap } from './fitPositionalShadow';

/** Looks down -z from `depth` in front of the origin, with a square 90-degree view. */
function cameraAt(depth: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 1000);
  camera.position.set(0, 0, depth);
  camera.updateMatrixWorld();
  return camera;
}

/** Not a size any slot gives, so a test sees whether the fit wrote one. */
const UNFITTED_SIZE = 64;

function castingOmni(range: number): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, 1, range);
  light.castShadow = true;
  light.shadow.mapSize.set(UNFITTED_SIZE, UNFITTED_SIZE);
  light.updateMatrixWorld();
  return light;
}

/** At the origin, shining down -z. */
function castingSpot(range: number): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffffff, 1, range, Math.PI / 4);
  light.castShadow = true;
  light.shadow.mapSize.set(UNFITTED_SIZE, UNFITTED_SIZE);
  light.target.position.set(0, 0, -1);
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  return light;
}

describe('fitPositionalShadow', () => {
  it('gives an omni light that fills the view half the largest slot per cube face', () => {
    const light = castingOmni(8);
    fitPositionalShadow(light, cameraAt(5), 2);
    expect(light.shadow.mapSize.toArray()).toEqual([512, 512]);
    // Godot's kernel of 2 * 2 / 1022 radians, in texels of a 512 face.
    expect(light.shadow.radius).toBeCloseTo((4 / 1022) * 512, 12);
  });

  it('gives a spot light that fills the view the largest slot, with a kernel of soft_shadow_scale texels', () => {
    const light = castingSpot(8);
    fitPositionalShadow(light, cameraAt(5), 2);
    expect(light.shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(light.shadow.radius).toBe(2);
  });

  it('gives a light far from the camera a smaller slot, and widens an omni kernel to match', () => {
    // A range of 1 at depth 50 covers 2 * 0.02 / 2 = 0.02 of the view: the 256 slot.
    const omni = castingOmni(1);
    fitPositionalShadow(omni, cameraAt(50), 2);
    expect(omni.shadow.mapSize.toArray()).toEqual([128, 128]);
    expect(omni.shadow.radius).toBeCloseTo((4 / 254) * 128, 12);
    const spot = castingSpot(1);
    fitPositionalShadow(spot, cameraAt(50), 2);
    expect(spot.shadow.mapSize.toArray()).toEqual([256, 256]);
  });

  it('leaves a light that casts no shadow as it is (edge case)', () => {
    const light = castingOmni(8);
    light.castShadow = false;
    fitPositionalShadow(light, cameraAt(5), 2);
    expect(light.shadow.mapSize.toArray()).toEqual([UNFITTED_SIZE, UNFITTED_SIZE]);
    expect(light.shadow.radius).toBe(1);
  });

  it('leaves the shadow as it is for a camera without a depth range (error case)', () => {
    const light = castingSpot(8);
    fitPositionalShadow(light, new THREE.Camera(), 2);
    expect(light.shadow.mapSize.toArray()).toEqual([UNFITTED_SIZE, UNFITTED_SIZE]);
    expect(light.shadow.radius).toBe(1);
  });
});

describe('resizeShadowMap', () => {
  it('drops the map for a new size, so three allocates one at that size', () => {
    const shadow = new THREE.PointLight().shadow;
    const map = new THREE.WebGLCubeRenderTarget(512);
    const dispose = vi.spyOn(map, 'dispose');
    shadow.map = map;
    resizeShadowMap(shadow, 256);
    expect(shadow.mapSize.toArray()).toEqual([256, 256]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(shadow.map).toBeNull();
  });

  it('keeps the map when the size is unchanged (edge case)', () => {
    const shadow = new THREE.SpotLight().shadow;
    const map = new THREE.WebGLRenderTarget(512, 512);
    shadow.map = map;
    resizeShadowMap(shadow, 512);
    expect(shadow.map).toBe(map);
  });

  it('sets the size on a shadow that has no map yet (error case)', () => {
    const shadow = new THREE.SpotLight().shadow;
    resizeShadowMap(shadow, 1024);
    expect(shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(shadow.map).toBeNull();
  });
});
