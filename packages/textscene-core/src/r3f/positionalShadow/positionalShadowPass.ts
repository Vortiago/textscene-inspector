/**
 * Godot's copy of each omni cube into its two paraboloids (`render_forward_clustered.cpp:2722-2738`).
 * three r186 has no hook between its shadow pass and its draw (`WebGLRenderer.js:1737-1752`), so the
 * renderer's shadow pass runs three's pass, then each copy, and then records the framebuffer height.
 */

import * as THREE from 'three';
import { AtlasOmniShadow } from './atlasOmniShadow.js';
import { writeFramebufferHeight } from './framebufferRows.js';
import { OmniShadowCopy } from './omniShadowCopy.js';

type ShadowPass = THREE.WebGLShadowMap['render'];

/** A global key, so a module that a dev server evaluates again finds the pass already wrapped. */
const WRAPPED = Symbol.for('textscene.positionalShadowPass');

interface OmniLight extends THREE.PointLight {
  shadow: AtlasOmniShadow;
}

/** Wraps `renderer`'s shadow pass once. A second call changes nothing. */
export function installPositionalShadowPass(renderer: THREE.WebGLRenderer): void {
  const shadowMap = renderer.shadowMap as THREE.WebGLShadowMap & { [WRAPPED]?: true };
  if (shadowMap[WRAPPED]) return;
  shadowMap[WRAPPED] = true;
  const threePass: ShadowPass = shadowMap.render.bind(shadowMap);
  const copy = new OmniShadowCopy();
  shadowMap.render = (lights, scene, camera) => {
    const copied = lightsToCopy(shadowMap, lights);
    threePass(lights, scene, camera);
    copyOmniShadows(renderer, copy, copied);
    // Last: each copy is a render of its own, which records the atlas's height.
    writeFramebufferHeight(renderer);
  };
}

/** Copies each light's cube into the atlas, and leaves the render target as it found it. */
function copyOmniShadows(
  renderer: THREE.WebGLRenderer,
  copy: OmniShadowCopy,
  lights: readonly OmniLight[]
): void {
  if (lights.length === 0) return;
  const target = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const mipmapLevel = renderer.getActiveMipmapLevel();
  for (const light of lights) {
    copy.copy(renderer, light, light.shadow.slot!);
    light.shadow.writeLookupMatrix(light);
  }
  renderer.setRenderTarget(target, face, mipmapLevel);
}

/**
 * The omni lights with a slot whose cube three's pass is about to draw, read before the pass, which
 * clears `needsUpdate` (`WebGLShadowMap.js:95`, `:170`, `:370`).
 */
function lightsToCopy(shadowMap: THREE.WebGLShadowMap, lights: readonly THREE.Light[]): OmniLight[] {
  if (!shadowMap.enabled || (!shadowMap.autoUpdate && !shadowMap.needsUpdate)) return [];
  return lights.filter((light): light is OmniLight => {
    const { shadow } = light as THREE.Light & { shadow?: unknown };
    return (
      shadow instanceof AtlasOmniShadow && shadow.slot !== null && (shadow.autoUpdate || shadow.needsUpdate)
    );
  });
}
