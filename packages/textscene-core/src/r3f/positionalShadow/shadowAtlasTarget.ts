/**
 * The one depth texture every positional shadow draws into, and every lit program samples through
 * one sampler, as Godot samples one positional shadow atlas (`scene_forward_clustered_inc.glsl:372`).
 * Every viewport lays its slots out in it. `positionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import {
  POSITIONAL_SHADOW_ATLAS_DEPTH_BITS,
  type PositionalShadowSlot,
} from '../../godot/rendering/lights/positionalShadowAtlas.js';
import { atlasTargetOf, createShadowAtlas } from '../shadowFilter/atlasTarget.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';
import type { LightShadowInternals } from '../sharedAtlasShadow.js';

/** The uniform every lit material samples the atlas through. */
export const POSITIONAL_SHADOW_ATLAS_UNIFORM = 'positionalShadowAtlas';

/** The uniform every lit material reads the atlas's raw depth through, from its colour. */
export const POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM = 'positionalShadowAtlasColour';

/** The 16-bit depth Godot's atlas stores, in three's type for it. */
const DEPTH_TYPE =
  POSITIONAL_SHADOW_ATLAS_DEPTH_BITS === 16 ? THREE.UnsignedShortType : THREE.UnsignedIntType;

/**
 * A depth texture that a linear filter compares, as Godot's `shadow_sampler` does
 * (`scene_shader_forward_clustered.cpp:995-1001`). Godot compares `GREATER` on its reversed depth, so
 * a lookup reads as lit only where the receiver is strictly nearer than the caster: `Less` here.
 */
function createAtlas(size: number): THREE.WebGLRenderTarget {
  return createShadowAtlas({
    name: 'PositionalShadowAtlas',
    size,
    type: DEPTH_TYPE,
    compare: THREE.LessCompare,
  });
}

/** A side for the atlas before any viewport holds it. Any size serves: the first holder resizes it. */
const UNHELD_SIZE = 1;

/**
 * The atlas an earlier evaluation of this module gave the lit materials, as after a dev server reloads
 * it. Every program compiled since samples that atlas, so this evaluation draws into it too.
 */
const atlas =
  atlasTargetOf(installedUniformValue(POSITIONAL_SHADOW_ATLAS_UNIFORM)) ?? createAtlas(UNHELD_SIZE);

/**
 * Each holder's atlas side. Written only by `holdPositionalShadowAtlas` and
 * `releasePositionalShadowAtlas`. The atlas takes the largest side, and frees its GPU memory when the
 * last holder lets go.
 */
const holders = new Map<object, number>();

/** The depth texture every lit program samples. */
export function positionalShadowAtlasDepth(): THREE.DepthTexture {
  return atlas.depthTexture!;
}

/** The colour every lit program reads the raw depth of an area light's slot from. */
export function positionalShadowAtlasColour(): THREE.Texture {
  return atlas.texture;
}

/** The atlas every positional shadow draws into. Its side is the largest any holder asks for. */
export function positionalShadowAtlas(): THREE.WebGLRenderTarget {
  return atlas;
}

/**
 * Holds the atlas for a viewport whose atlas is `size` texels square. Every viewport shares the one
 * texture: each render draws its own slots before it samples them.
 */
export function holdPositionalShadowAtlas(holder: object, size: number): void {
  holders.set(holder, size);
  fitToHolders();
}

/** Lets go of the atlas for `holder`. The last holder frees its GPU memory. A stranger changes nothing. */
export function releasePositionalShadowAtlas(holder: object): void {
  if (!holders.delete(holder)) return;
  if (holders.size === 0) atlas.dispose();
  else fitToHolders();
}

/** `setSize` frees the GPU memory of a target whose size changes, and three builds it again at its next use. */
function fitToHolders(): void {
  const size = Math.max(UNHELD_SIZE, ...holders.values());
  if (atlas.width !== size) atlas.setSize(size, size);
}

/**
 * Points `shadow` at `slot` of the atlas, and writes the slot's rectangle, in units of the slot as
 * three gives a viewport, into `slotRect`. `mapSize` is the slot and the frame extents are the atlas
 * over the slot, so three asks for the atlas's own size and never resizes it
 * (`WebGLShadowMap.js:172-176`, `:281-285`, `:345-350`).
 */
export function drawIntoAtlasSlot(
  shadow: THREE.LightShadow & LightShadowInternals,
  slot: PositionalShadowSlot,
  slotRect: THREE.Vector4
): void {
  shadow.map = positionalShadowAtlas();
  const atlasSize = shadow.map.width;
  shadow.mapSize.set(slot.size, slot.size);
  shadow._frameExtents.set(atlasSize / slot.size, atlasSize / slot.size);
  slotRect.set(slot.x / slot.size, slot.y / slot.size, 1, 1);
  shadow._viewports[0]!.copy(slotRect);
}
