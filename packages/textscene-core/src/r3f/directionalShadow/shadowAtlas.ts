/**
 * Godot's directional shadow atlas: one depth texture that every shadowed directional light draws
 * its share into (`light_storage.cpp:2572-2621`), and that every lit program samples through one
 * sampler (`shadowAtlasChunk.ts`). Each split shadow holds it while it lives.
 */

import * as THREE from 'three';
import { DIRECTIONAL_SHADOW_SIZE_DEFAULT } from '../../godot/directionalShadow.js';

/** The uniform every lit material samples the atlas through. */
export const DIRECTIONAL_SHADOW_ATLAS_UNIFORM = 'directionalShadowAtlas';

/**
 * The atlas's depth. `cloneUniforms` clones a texture for each material (three r186
 * `UniformsUtils.js:28-39`), and a clone would name a texture no shadow pass draws. So a clone of
 * this texture is the texture itself, and every material samples the one atlas.
 */
class AtlasDepthTexture extends THREE.DepthTexture {
  override clone(): this {
    return this;
  }
}

/**
 * The target as three builds a PCF shadow map (r186 `WebGLShadowMap.js:253-266`), which three draws
 * for `TscnCanvas`'s soft shadows (`:99-102`).
 */
function createAtlas(): THREE.WebGLRenderTarget {
  const atlas = new THREE.WebGLRenderTarget(DIRECTIONAL_SHADOW_SIZE_DEFAULT, DIRECTIONAL_SHADOW_SIZE_DEFAULT);
  const depth = new AtlasDepthTexture(
    DIRECTIONAL_SHADOW_SIZE_DEFAULT,
    DIRECTIONAL_SHADOW_SIZE_DEFAULT,
    THREE.UnsignedIntType
  );
  depth.name = 'DirectionalShadowAtlas';
  depth.format = THREE.DepthFormat;
  depth.compareFunction = THREE.LessEqualCompare;
  depth.minFilter = THREE.LinearFilter;
  depth.magFilter = THREE.LinearFilter;
  atlas.depthTexture = depth;
  return atlas;
}

/**
 * The atlas an earlier evaluation of this module gave `ShaderLib`, as after a dev server reloads
 * it. Every program compiled since samples that atlas, so this evaluation draws into it too.
 */
function installedAtlas(): THREE.WebGLRenderTarget | null {
  const installed: unknown = THREE.ShaderLib.standard.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM]?.value;
  if (!(installed instanceof THREE.DepthTexture)) return null;
  return installed.renderTarget instanceof THREE.WebGLRenderTarget ? installed.renderTarget : null;
}

const atlas = installedAtlas() ?? createAtlas();

/**
 * The shadows that draw into the atlas. Written only by `holdDirectionalShadowAtlas` and
 * `releaseDirectionalShadowAtlas`. The atlas frees its GPU memory when the last one lets go.
 */
const holders = new Set<THREE.LightShadow>();

/** The depth texture every lit program samples. */
export function directionalShadowAtlasDepth(): THREE.DepthTexture {
  return atlas.depthTexture!;
}

/** The atlas, which `shadow` draws its share into until it lets go. */
export function holdDirectionalShadowAtlas(shadow: THREE.LightShadow): THREE.WebGLRenderTarget {
  holders.add(shadow);
  return atlas;
}

/**
 * Lets go of the atlas for `shadow`. The last holder frees its GPU memory, and three builds it
 * again at the next shadow pass that draws into it. A shadow that holds nothing changes nothing.
 */
export function releaseDirectionalShadowAtlas(shadow: THREE.LightShadow): void {
  if (!holders.delete(shadow) || holders.size > 0) return;
  atlas.dispose();
}
