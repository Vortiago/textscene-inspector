/**
 * The sampler state of a render-target albedo map, applied in the material's program. A render
 * target never clones (`applyTextureState.ts`), and every reader shares its transform and its
 * wrapping, so the UV transform a slot needs, a glTF surface's V flip included, and Godot's
 * repeat ride on the material instead.
 */

import * as THREE from 'three';
import type { IUniform, Material } from 'three';
import { composeInjections, type ProgramInjection } from '../materialProgramInputs';
import type { UVTransform } from '../../resources/textures/applyTextureState';
import { recordedOn } from './recordedOnMaterial';

/** Where a material records the transform its render-target map samples through. */
const TARGET_MAP_UV_KEY = 'godotTargetMapUv';

const IDENTITY_UV: UVTransform = { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };

/** The `userData` that gives a render-target albedo map `uv`, none for undefined. */
export function renderTargetMapUserData(uv: UVTransform | undefined): Record<string, unknown> {
  return uv ? { [TARGET_MAP_UV_KEY]: uv } : {};
}

/** A uniform that reads `material`'s recorded transform at each upload, into one matrix. */
function targetMapTransform(material: Material): IUniform<THREE.Matrix3> {
  const matrix = new THREE.Matrix3();
  return {
    get value() {
      const { scale, offset } = recordedOn(material, TARGET_MAP_UV_KEY, IDENTITY_UV);
      return matrix.setUvTransform(offset.x, offset.y, scale.x, scale.y, 0, 0, 0);
    },
  };
}

const UV_PARS = `#include <uv_pars_vertex>
uniform mat3 godotTargetMapTransform;`;

/** After three's chunk, so a patch that also anchors on it composes in either order. */
const UV = `#include <uv_vertex>
#ifdef USE_MAP
	vMapUv = ( godotTargetMapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif`;

const TARGET_MAP_UV: ProgramInjection = {
  cacheKey: 'godot-target-map-uv',
  onBeforeCompile(shader) {
    shader.uniforms['godotTargetMapTransform'] = targetMapTransform(this);
    shader.vertexShader = shader.vertexShader
      .replace('#include <uv_pars_vertex>', UV_PARS)
      .replace('#include <uv_vertex>', UV);
  },
};

const MAP_PARS = '#include <map_pars_fragment>';
const MAP = '#include <map_fragment>';
const MAP_SAMPLE = 'texture2D( map, vMapUv )';

/**
 * Bilinear filtering by hand, with each texel index wrapped, as a repeating linear sampler reads
 * the target. The target is linear and has no mipmaps (`offscreenViewport.ts`), so the four texels
 * are all the hardware would read.
 */
const REPEAT_SAMPLE_PARS = /* glsl */ `${MAP_PARS}
#ifdef USE_MAP
vec4 godotTargetMapSample( const in vec2 uv ) {
	vec2 size = vec2( textureSize( map, 0 ) );
	vec2 texel = uv * size - 0.5;
	vec2 corner = floor( texel );
	vec2 weight = texel - corner;
	ivec2 near = ivec2( mod( corner, size ) );
	ivec2 far = ivec2( mod( corner + 1.0, size ) );
	return mix(
		mix( texelFetch( map, near, 0 ), texelFetch( map, ivec2( far.x, near.y ), 0 ), weight.x ),
		mix( texelFetch( map, ivec2( near.x, far.y ), 0 ), texelFetch( map, far, 0 ), weight.x ),
		weight.y
	);
}
#endif`;

/**
 * three's map chunk inlined, as `onBeforeCompile` sees only the `#include`, with the wrapped
 * sample in place of the hardware one. Read at each compile, so it holds the chunk as the shader
 * patches leave it. It replaces the include, so it runs after any patch that anchors on it.
 */
const TARGET_MAP_REPEAT: ProgramInjection = {
  cacheKey: 'godot-target-map-repeat',
  onBeforeCompile(shader) {
    const mapFragment = THREE.ShaderChunk.map_fragment.replace(MAP_SAMPLE, 'godotTargetMapSample( vMapUv )');
    shader.fragmentShader = shader.fragmentShader
      .replace(MAP_PARS, REPEAT_SAMPLE_PARS)
      .replace(MAP, mapFragment);
  },
};

/**
 * What a material whose albedo is a render target compiles with: its UV transform, and the wrap
 * Godot's `texture_repeat` sampler gives, where three's target clamps. Last among a material's
 * injections, as the repeat replaces the map chunk's include.
 */
export function renderTargetMapInjection(repeats: boolean): ProgramInjection | undefined {
  return composeInjections([TARGET_MAP_UV, repeats ? TARGET_MAP_REPEAT : undefined]);
}
