import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas';
import { adoptAtlasShadow } from './adoptAtlasShadow';
import { AtlasOmniShadow } from './atlasOmniShadow';
import { AtlasSpotShadow } from './atlasSpotShadow';
import { fitPositionalShadow } from './fitPositionalShadow';
import { positionalShadowAtlas } from './shadowAtlasTarget';

const declaration = { normalBias: 1, softShadowScale: 2 };

const spotSlot = (size: number): PositionalShadowSlot => ({ x: 0, y: 0, size, paraboloidStep: null });
const omniSlot = (size: number): PositionalShadowSlot => ({ x: 0, y: 0, size, paraboloidStep: [1, 0] });

const omni = () => adoptAtlasShadow(new THREE.PointLight()) as THREE.PointLight & { shadow: AtlasOmniShadow };
const spot = () => adoptAtlasShadow(new THREE.SpotLight()) as THREE.SpotLight & { shadow: AtlasSpotShadow };

describe('fitPositionalShadow', () => {
  it('gives an omni light in the largest slot a cube of half the slot per face', () => {
    const light = omni();
    fitPositionalShadow(light, omniSlot(1024), declaration);
    expect(light.shadow.mapSize.toArray()).toEqual([512, 512]);
    expect(light.shadow.map!.width).toBe(512);
    expect(light.shadow.slot).toEqual(omniSlot(1024));
    expect(light.shadow.normalBias).toBeCloseTo(10 / 1024, 12);
    expect(light.shadow.intensity).toBe(1);
  });

  it('gives both lookups Godot’s soft_shadow_scale, which each spreads in its own units', () => {
    const [omniLight, spotLight] = [omni(), spot()];
    fitPositionalShadow(omniLight, omniSlot(256), declaration);
    fitPositionalShadow(spotLight, spotSlot(512), declaration);
    expect(omniLight.shadow.radius).toBe(2);
    expect(spotLight.shadow.radius).toBe(2);
  });

  it('draws a spot light into its slot of the atlas', () => {
    const light = spot();
    fitPositionalShadow(light, spotSlot(512), declaration);
    expect(light.shadow.map).toBe(positionalShadowAtlas());
    expect(light.shadow.mapSize.toArray()).toEqual([512, 512]);
    expect(light.shadow.normalBias).toBeCloseTo(10 / 512, 12);
  });

  it('builds the projection from the near and far planes the light’s component set', () => {
    const light = spot();
    light.shadow.camera.near = 0.025;
    light.shadow.camera.far = 8;
    fitPositionalShadow(light, spotSlot(512), declaration);
    const expected = light.shadow.camera.clone();
    expected.updateProjectionMatrix();
    expect(light.shadow.camera.projectionMatrix.equals(expected.projectionMatrix)).toBe(true);
  });

  it('keeps an omni light’s cube while its slot keeps its size (edge case)', () => {
    const light = omni();
    fitPositionalShadow(light, omniSlot(1024), declaration);
    const cube = light.shadow.map;
    fitPositionalShadow(light, omniSlot(1024), declaration);
    expect(light.shadow.map).toBe(cube);
  });

  it('draws nothing for a light without a slot, and leaves its map as it is (error case)', () => {
    const light = omni();
    fitPositionalShadow(light, null, declaration);
    expect(light.shadow.intensity).toBe(0);
    expect(light.shadow.autoUpdate).toBe(false);
    expect(light.shadow.slot).toBeNull();
    expect(light.shadow.map).toBeNull();
  });

  it('draws the shadow again once the light holds a slot (edge case)', () => {
    const light = spot();
    fitPositionalShadow(light, null, declaration);
    fitPositionalShadow(light, spotSlot(1024), declaration);
    expect(light.shadow.intensity).toBe(1);
    expect(light.shadow.autoUpdate).toBe(true);
  });

  it('frees an omni cube of another size (edge case)', () => {
    const light = omni();
    fitPositionalShadow(light, omniSlot(1024), declaration);
    const dispose = vi.spyOn(light.shadow.map!, 'dispose');
    fitPositionalShadow(light, omniSlot(512), declaration);
    expect(dispose).toHaveBeenCalledOnce();
    expect(light.shadow.map!.width).toBe(256);
  });
});
