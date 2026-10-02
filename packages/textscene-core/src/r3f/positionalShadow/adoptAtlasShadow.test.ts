import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { adoptAtlasShadow } from './adoptAtlasShadow';
import { AtlasOmniShadow } from './atlasOmniShadow';
import { AtlasSpotShadow } from './atlasSpotShadow';
import { positionalShadowAtlas } from './shadowAtlasTarget';

describe('adoptAtlasShadow', () => {
  it('gives a spot light a shadow that draws into the atlas, with what its component set', () => {
    const light = new THREE.SpotLight();
    light.shadow.bias = 0.003;
    light.shadow.camera.near = 0.025;
    light.shadow.camera.far = 8;
    adoptAtlasShadow(light);
    expect(light.shadow).toBeInstanceOf(AtlasSpotShadow);
    expect(light.shadow.map).toBe(positionalShadowAtlas());
    expect(light.shadow.bias).toBe(0.003);
    expect([light.shadow.camera.near, light.shadow.camera.far]).toEqual([0.025, 8]);
  });

  it('gives an omni light a shadow that copies its cube into the atlas', () => {
    const light = new THREE.PointLight();
    light.shadow.bias = 0.2;
    adoptAtlasShadow(light);
    expect(light.shadow).toBeInstanceOf(AtlasOmniShadow);
    expect(light.shadow.bias).toBe(0.2);
    expect(light.shadow.map).toBeNull();
  });

  it('frees the map three built for the old shadow', () => {
    const light = new THREE.SpotLight();
    const threeMap = new THREE.WebGLRenderTarget(512, 512);
    const dispose = vi.spyOn(threeMap, 'dispose');
    light.shadow.map = threeMap;
    adoptAtlasShadow(light);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('keeps the shadow it gave on a later call (edge case)', () => {
    const light = new THREE.PointLight();
    const adopted = adoptAtlasShadow(light).shadow;
    expect(adoptAtlasShadow(light).shadow).toBe(adopted);
  });
});
