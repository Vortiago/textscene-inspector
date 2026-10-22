import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AREA_LIGHT_SHADOW_MATRICES,
  AREA_LIGHT_SHADOW_RECTS,
  AREA_LIGHT_SHADOWS,
  AREA_LIGHT_SOFT_SHADOW_RADII,
  installAreaLightShadowUniforms,
  writeAreaLightShadowUniforms,
} from './areaLightShadowUniforms';
import { litUniformArray } from '../testing/litUniformArray';
import { AtlasAreaShadow, type AreaShadowLight } from '../positionalShadow/atlasAreaShadow';
import { holdPositionalShadowAtlas } from '../positionalShadow/shadowAtlasTarget';

holdPositionalShadowAtlas({}, 4096);

/** A casting light 3 over the origin, shining down, in a 1024 slot at the atlas's middle. */
function castingLight(): AreaShadowLight {
  const light = new THREE.RectAreaLight() as AreaShadowLight;
  light.position.set(0, 3, 0);
  light.rotation.x = -Math.PI / 2;
  light.updateMatrixWorld();
  light.castShadow = true;
  light.shadow = new AtlasAreaShadow();
  light.shadow.range = 6;
  light.shadow.size.set(2, 1);
  light.shadow.place({ x: 2048, y: 2048, size: 1024, paraboloidStep: null });
  light.shadow.intensity = 0.75;
  light.shadow.normalBias = 0.02;
  light.shadow.bias = 0.1;
  light.shadow.radius = -0.75;
  return light;
}

function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera();
  view.updateMatrixWorld();
  return view;
}

/** The `width` floats at `index` of the lit uniform `name`. */
function at(name: string, index: number, width: number): number[] {
  installAreaLightShadowUniforms();
  return Array.from(litUniformArray(name).subarray(index * width, (index + 1) * width));
}

describe('writeAreaLightShadowUniforms', () => {
  it("writes each light's opacity, normal bias, bias and depth scale", () => {
    writeAreaLightShadowUniforms([castingLight()], camera());
    const [opacity, normalBias, bias, depthScale] = at(AREA_LIGHT_SHADOWS, 0, 4);
    expect([opacity, normalBias, bias]).toEqual([0.75, Math.fround(0.02), Math.fround(0.1)]);
    expect(depthScale).toBeCloseTo(1 / (6 + Math.hypot(2, 1) / 2), 6);
  });

  it("writes each light's soft shadow radius", () => {
    writeAreaLightShadowUniforms([castingLight()], camera());
    expect(at(AREA_LIGHT_SOFT_SHADOW_RADII, 0, 1)).toEqual([-0.75]);
  });

  it("writes each light's slot in units of the atlas", () => {
    writeAreaLightShadowUniforms([castingLight()], camera());
    expect(at(AREA_LIGHT_SHADOW_RECTS, 0, 4)).toEqual([0.5, 0.5, 0.25, 0.25]);
  });

  it('writes an empty slot for a casting light without one, over the last light’s (edge case)', () => {
    writeAreaLightShadowUniforms([castingLight()], camera());
    const unplaced = castingLight();
    unplaced.shadow.place(null);
    writeAreaLightShadowUniforms([unplaced], camera());
    expect(at(AREA_LIGHT_SHADOW_RECTS, 0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('writes the matrix from view space into the light’s own', () => {
    writeAreaLightShadowUniforms([castingLight()], camera());
    const matrix = new THREE.Matrix4().fromArray(at(AREA_LIGHT_SHADOW_MATRICES, 0, 16));
    const point = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
    expect(point.distanceTo(new THREE.Vector3(0, 0, -3))).toBeCloseTo(0, 6);
  });

  it('writes no opacity for a light that casts nothing, at its index (edge case)', () => {
    const dark = castingLight();
    dark.castShadow = false;
    writeAreaLightShadowUniforms([castingLight(), dark], camera());
    expect(at(AREA_LIGHT_SHADOWS, 1, 4)[0]).toBe(0);
  });

  it('writes no opacity for a light without the atlas shadow (error case)', () => {
    const plain = new THREE.RectAreaLight();
    plain.castShadow = true;
    writeAreaLightShadowUniforms([castingLight(), plain], camera());
    expect(at(AREA_LIGHT_SHADOWS, 1, 4)[0]).toBe(0);
  });
});
