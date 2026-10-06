/**
 * Godot's directional shadow atlas: one depth texture that every shadowed directional light draws
 * its share into (`light_storage.cpp:2572-2621`), and that every lit program samples through one
 * sampler (`shadowAtlasChunk.ts`). Each split shadow holds it while it lives.
 */

import * as THREE from 'three';
import { DIRECTIONAL_SHADOW_SIZE_DEFAULT } from '../../godot/directionalShadow.js';
import { AtlasDepthTexture, atlasTargetOf } from '../shadowFilter/atlasDepthTexture.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';

/** The uniform every lit material samples the atlas through. */
export const DIRECTIONAL_SHADOW_ATLAS_UNIFORM = 'directionalShadowAtlas';

/**
 * The target as three builds a PCF shadow map (r186 `WebGLShadowMap.js:253-266`), the type
 * `TscnCanvas` asks for.
 */
function createAtlas(): THREE.WebGLRenderTarget {
  const atlas = new THREE.WebGLRenderTarget(DIRECTIONAL_SHADOW_SIZE_DEFAULT, DIRECTIONAL_SHADOW_SIZE_DEFAULT);
  atlas.depthTexture = new AtlasDepthTexture({
    name: 'DirectionalShadowAtlas',
    size: DIRECTIONAL_SHADOW_SIZE_DEFAULT,
    type: THREE.UnsignedIntType,
    compare: THREE.LessEqualCompare,
  });
  return atlas;
}

/**
 * The atlas an earlier evaluation of this module gave the lit materials, as after a dev server
 * reloads it. Every program compiled since samples that atlas, so this evaluation draws into it too.
 */
const atlas = atlasTargetOf(installedUniformValue(DIRECTIONAL_SHADOW_ATLAS_UNIFORM)) ?? createAtlas();

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
