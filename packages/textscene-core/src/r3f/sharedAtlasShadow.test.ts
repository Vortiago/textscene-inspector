import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { confineShadowScissor } from './sharedAtlasShadow';

/** A shadow drawing into a 4096 atlas, one 1024 rectangle at a time. */
function atlasShadow(): THREE.LightShadow {
  const shadow = new THREE.DirectionalLight().shadow;
  shadow.map = new THREE.WebGLRenderTarget(4096, 4096);
  shadow.mapSize.set(1024, 1024);
  return shadow;
}

describe('confineShadowScissor', () => {
  it('scissors the atlas to the rectangle, in texels of the map size', () => {
    const shadow = atlasShadow();
    confineShadowScissor(shadow, new THREE.Vector4(2, 1, 2, 1));
    expect(shadow.map!.scissor.toArray()).toEqual([2048, 1024, 2048, 1024]);
    expect(shadow.map!.scissorTest).toBe(true);
  });

  it('scales with a map size three shrank to fit the GPU (edge case)', () => {
    const shadow = atlasShadow();
    shadow.mapSize.set(512, 512);
    confineShadowScissor(shadow, new THREE.Vector4(2, 1, 1, 1));
    expect(shadow.map!.scissor.toArray()).toEqual([1024, 512, 512, 512]);
  });

  it('scissors nothing for a shadow without a map (error case)', () => {
    const shadow = new THREE.DirectionalLight().shadow;
    expect(() => confineShadowScissor(shadow, new THREE.Vector4(0, 0, 1, 1))).not.toThrow();
    expect(shadow.map).toBeNull();
  });
});
