/**
 * The one depth texture every omni and spot shadow draws into, and every lit program samples through
 * one sampler, as Godot samples one positional shadow atlas (`scene_forward_clustered_inc.glsl:372`).
 * Every viewport lays its slots out in it. `positionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import { POSITIONAL_SHADOW_ATLAS_DEPTH_BITS } from '../../godot/positionalShadowAtlas.js';

/** The uniform every lit material samples the atlas through. */
export const POSITIONAL_SHADOW_ATLAS_UNIFORM = 'positionalShadowAtlas';

/**
 * `cloneUniforms` clones a texture for each material (three r186 `UniformsUtils.js:28-39`), and a
 * clone would name a texture no shadow pass draws. So a clone of this texture is the texture itself.
 */
class AtlasDepthTexture extends THREE.DepthTexture {
  override clone(): this {
    return this;
  }
}

/** The 16-bit depth Godot's atlas stores, in three's type for it. */
const DEPTH_TYPE =
  POSITIONAL_SHADOW_ATLAS_DEPTH_BITS === 16 ? THREE.UnsignedShortType : THREE.UnsignedIntType;

/**
 * A depth texture that a linear filter compares, as Godot's `shadow_sampler` does
 * (`scene_shader_forward_clustered.cpp:995-1001`). Godot compares `GREATER` on its reversed depth, so
 * a lookup reads as lit only where the receiver is strictly nearer than the caster: `Less` here.
 * three needs a colour attachment, so it is the smallest one it renders: one 8-bit channel.
 */
function createAtlas(size: number): THREE.WebGLRenderTarget {
  const atlas = new THREE.WebGLRenderTarget(size, size, { format: THREE.RedFormat, depthBuffer: true });
  const depth = new AtlasDepthTexture(size, size, DEPTH_TYPE);
  depth.name = 'PositionalShadowAtlas';
  depth.format = THREE.DepthFormat;
  depth.compareFunction = THREE.LessCompare;
  depth.minFilter = THREE.LinearFilter;
  depth.magFilter = THREE.LinearFilter;
  atlas.depthTexture = depth;
  return atlas;
}

/**
 * The atlas an earlier evaluation of this module gave `ShaderLib`, as after a dev server reloads it.
 * Every program compiled since samples that atlas, so this evaluation draws into it too.
 */
function installedAtlas(): THREE.WebGLRenderTarget | null {
  const installed: unknown = THREE.ShaderLib.standard.uniforms[POSITIONAL_SHADOW_ATLAS_UNIFORM]?.value;
  if (!(installed instanceof THREE.DepthTexture)) return null;
  return installed.renderTarget instanceof THREE.WebGLRenderTarget ? installed.renderTarget : null;
}

/** A side for the atlas before any viewport holds it. Any size serves: the first holder resizes it. */
const UNHELD_SIZE = 1;

const atlas = installedAtlas() ?? createAtlas(UNHELD_SIZE);

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
