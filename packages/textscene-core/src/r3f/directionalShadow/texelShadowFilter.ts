/**
 * Godot's PCF kernel, in texels of each axis of the map. Godot scales its directional kernel by one
 * atlas texel per axis (`renderer_scene_render_rd.cpp:1388-1389`, passed at
 * `scene_forward_clustered.glsl:2443`) times `soft_shadow_scale`, which the fitter writes as the
 * light's `shadow.radius`. A light's map is its share of the atlas, so its texels are atlas texels
 * on both axes, even where the share is twice as tall as it is wide.
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';

const CHUNK = 'shadowmap_pars_fragment';

/**
 * three r186's PCF lookup scales both axes by one texel of the map's width
 * (`shadowmap_pars_fragment.glsl.js:164-165`), so a map twice as tall as it is wide blurs twice as
 * many texels down it as across it.
 */
const THREE_RADIUS = 'float radius = shadowRadius * texelSize.x;';
const PER_AXIS_RADIUS = 'vec2 radius = shadowRadius * texelSize;';

/** The chunk with a per-axis kernel, or null when three's chunk no longer has the line it replaces. */
export function texelShadowFilterChunk(chunk: string): string | null {
  return chunk.includes(THREE_RADIUS) ? chunk.replace(THREE_RADIUS, PER_AXIS_RADIUS) : null;
}

/**
 * Replaces three's chunk for every program compiled after the call. A square map samples the same
 * texels as before, so only a shared, non-square map changes. A three release that rewrites the
 * line keeps its own chunk, and `texelShadowFilter.test.ts` fails on that release. A second call
 * changes nothing.
 */
export function installTexelShadowFilter(): void {
  if (THREE.ShaderChunk[CHUNK].includes(PER_AXIS_RADIUS)) return;
  const patched = texelShadowFilterChunk(THREE.ShaderChunk[CHUNK]);
  if (patched === null) {
    warn(`[Shading] three's ${CHUNK} has no PCF kernel radius to replace`);
    return;
  }
  THREE.ShaderChunk[CHUNK] = patched;
}
