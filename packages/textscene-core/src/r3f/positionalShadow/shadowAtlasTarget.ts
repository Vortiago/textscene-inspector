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

/** The atlas's side while no viewport holds it: lit programs sample it with no slot drawn. */
const UNHELD_SIZE = 1;

/**
 * The atlas an earlier evaluation of this module gave the lit materials, as after a dev server reloads
 * it. Every program compiled since samples that atlas, so this evaluation draws into it too.
 */
const atlas =
  atlasTargetOf(installedUniformValue(POSITIONAL_SHADOW_ATLAS_UNIFORM)) ?? createAtlas(UNHELD_SIZE);

/** Each holder's atlas side. Written only by the hold and the release below. */
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

/** Holds the atlas for a viewport whose atlas is `size` texels square and whose lights hold slots. */
export function holdPositionalShadowAtlas(holder: object, size: number): void {
  holders.set(holder, size);
  fitToHolders();
}

/** The last holder frees the GPU memory and shrinks the atlas, which the shadow pass allocates again. */
export function releasePositionalShadowAtlas(holder: object): void {
  if (!holders.delete(holder)) return;
  if (holders.size > 0) fitToHolders();
  else if (atlas.width === UNHELD_SIZE) free();
  else resize(UNHELD_SIZE);
}

function fitToHolders(): void {
  const size = Math.max(UNHELD_SIZE, ...holders.values());
  if (atlas.width !== size) resize(size);
}

/** Counts the atlas's frees. Written only by `free` and `resize`. */
let build = 0;

/** Moves each time the atlas frees its GPU memory, so a renderer knows to allocate it again. */
export function positionalShadowAtlasBuild(): number {
  return build;
}

function free(): void {
  atlas.dispose();
  build++;
}

/** `setSize` frees the GPU memory of a resized target, and three builds it again at its next use. */
function resize(size: number): void {
  atlas.setSize(size, size);
  build++;
}

/**
 * Points `shadow` at `slot` of the atlas, and writes the slot's rectangle, in units of the slot as
 * three gives a viewport, into `slotRect`. `mapSize` is the slot and the frame extents are the atlas
 * over the slot, so three asks for the atlas's own size and never resizes it
 * (r187 `WebGLShadowMap.js:172-176`, `:281-285`, `:347-352`).
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
