/**
 * Godot's directional shadow atlas: one depth texture that every shadowed directional light draws
 * its share into (`light_storage.cpp:2572-2621`), and that every lit program samples through one
 * sampler (`shadowAtlasChunk.ts`). Each split shadow holds it while it lives.
 */

import * as THREE from 'three';
import {
  DIRECTIONAL_SHADOW_ATLAS_DEPTH_BITS,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
} from '../../godot/rendering/lights/directionalShadow.js';
import { atlasTargetOf, createShadowAtlas } from '../shadowFilter/atlasTarget.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';
import type { StoredDepthRead } from '../../shaders/spatial/directionalShadowDepth.js';

/** The uniform every lit material samples the atlas through. */
export const DIRECTIONAL_SHADOW_ATLAS_UNIFORM = 'directionalShadowAtlas';

/** The uniform every lit material reads the atlas's raw depth through, from its colour. */
export const DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM = 'directionalShadowAtlasColour';

/** The atlas in Godot's default depth bits, which the raw depth in its colour also holds. */
function createAtlas(): THREE.WebGLRenderTarget {
  const atlas = createShadowAtlas({
    name: 'DirectionalShadowAtlas',
    size: DIRECTIONAL_SHADOW_SIZE_DEFAULT,
    type: DIRECTIONAL_SHADOW_ATLAS_DEPTH_BITS === 16 ? THREE.UnsignedShortType : THREE.UnsignedIntType,
    compare: THREE.LessEqualCompare,
  });
  // A translated lit surface samples the colour filtered, as Godot samples its depth.
  atlas.texture.minFilter = THREE.LinearFilter;
  atlas.texture.magFilter = THREE.LinearFilter;
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

/** The colour every lit program reads the raw depth from. */
export function directionalShadowAtlasColour(): THREE.Texture {
  return atlas.texture;
}

/** Gives the colour the format of `read`. A change frees the atlas, which three builds at its next draw. */
export function formatDirectionalShadowColour(read: StoredDepthRead): void {
  const colour = atlas.texture;
  const [format, type] = read === 'float' ? FLOAT_COLOUR : BYTE_COLOUR;
  if (colour.format === format && colour.type === type) return;
  colour.format = format;
  colour.type = type;
  atlas.dispose();
}

/** The float colour costs four bytes per texel against two: 32 MB more at Godot's default size. */
const FLOAT_COLOUR = [THREE.RedFormat, THREE.FloatType] as const;
const BYTE_COLOUR = [THREE.RGFormat, THREE.UnsignedByteType] as const;

/** True when `target` is the atlas itself, as three binds it to draw a sun. */
export function isDirectionalShadowAtlas(target: THREE.WebGLRenderTarget | null): boolean {
  return target === atlas;
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
