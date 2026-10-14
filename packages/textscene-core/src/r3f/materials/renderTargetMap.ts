/**
 * The sampler state of a render-target albedo map, applied in the material's program. A render
 * target never clones (`applyTextureState.ts`), and every reader shares its transform, its
 * wrapping and its filter, so the UV transform a slot needs, a glTF surface's V flip included,
 * and Godot's repeat and filter ride on the material instead.
 */

import * as THREE from 'three';
import type { IUniform, Material } from 'three';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';
import type { UVTransform } from '../../resources/textures/applyTextureState';
import { recordedOn } from './recordedOnMaterial';

/** How a material samples its render-target albedo: Godot's sampler state for the slot. */
export interface TargetMapSampler {
  uv: UVTransform;
  /** `texture_repeat`: whether a UV outside 0..1 wraps or clamps. */
  repeats: boolean;
  /** Whether `texture_filter` reads the nearest texel. */
  isNearest: boolean;
}

/** Where a material records its render-target albedo sampler. */
const TARGET_MAP_KEY = 'godotTargetMap';

const IDENTITY_UV: UVTransform = { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };

/** The `userData` that gives a material its render-target albedo sampler, none for undefined. */
export function renderTargetMapUserData(sampler: TargetMapSampler | undefined): Record<string, unknown> {
  return sampler ? { [TARGET_MAP_KEY]: sampler } : {};
}

/**
 * A uniform that reads `material`'s recorded transform at each upload, into one matrix. It
 * rebuilds the matrix only when the recorded transform is another object.
 */
function targetMapTransform(material: Material): IUniform<THREE.Matrix3> {
  const matrix = new THREE.Matrix3();
  let built: UVTransform | undefined;
  return {
    get value() {
      const uv =
        recordedOn<TargetMapSampler | undefined>(material, TARGET_MAP_KEY, undefined)?.uv ?? IDENTITY_UV;
      if (uv !== built) {
        matrix.setUvTransform(uv.offset.x, uv.offset.y, uv.scale.x, uv.scale.y, 0, 0, 0);
        built = uv;
      }
      return matrix;
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
 * Godot's sampler by hand: each texel index wrapped or clamped, then the nearest texel or a
 * bilinear blend of four. The target is linear and has no mipmaps (`offscreenViewport.ts`), so
 * those four texels are all the hardware would read.
 */
const SAMPLE_PARS = /* glsl */ `${MAP_PARS}
#ifdef USE_MAP
ivec2 godotTargetMapTexel( const in vec2 texel, const in vec2 size ) {
	#ifdef GODOT_TARGET_MAP_WRAPS
		return ivec2( mod( texel, size ) );
	#else
		return ivec2( clamp( texel, vec2( 0.0 ), size - 1.0 ) );
	#endif
}
vec4 godotTargetMapSample( const in vec2 uv ) {
	vec2 size = vec2( textureSize( map, 0 ) );
	#ifdef GODOT_TARGET_MAP_NEAREST
		return texelFetch( map, godotTargetMapTexel( floor( uv * size ), size ), 0 );
	#else
		vec2 texel = uv * size - 0.5;
		vec2 corner = floor( texel );
		vec2 weight = texel - corner;
		ivec2 near = godotTargetMapTexel( corner, size );
		ivec2 far = godotTargetMapTexel( corner + 1.0, size );
		return mix(
			mix( texelFetch( map, near, 0 ), texelFetch( map, ivec2( far.x, near.y ), 0 ), weight.x ),
			mix( texelFetch( map, ivec2( near.x, far.y ), 0 ), texelFetch( map, far, 0 ), weight.x ),
			weight.y
		);
	#endif
}
#endif`;

/**
 * three's map chunk inlined, as `onBeforeCompile` sees only the `#include`, with Godot's sample in
 * place of the hardware one. Read at each compile, so it holds the chunk as the shader patches
 * leave it. It replaces the include, so it runs after any patch that anchors on it.
 */
const TARGET_MAP_SAMPLE: ProgramInjection = {
  cacheKey: 'godot-target-map-sample',
  onBeforeCompile(shader) {
    const mapFragment = THREE.ShaderChunk.map_fragment.replace(MAP_SAMPLE, 'godotTargetMapSample( vMapUv )');
    shader.fragmentShader = shader.fragmentShader.replace(MAP_PARS, SAMPLE_PARS).replace(MAP, mapFragment);
  },
};

const WRAPS = defining('GODOT_TARGET_MAP_WRAPS');
const NEAREST = defining('GODOT_TARGET_MAP_NEAREST');

/**
 * What a material whose `userData` records a render-target albedo compiles with, none for one that
 * records none. A linear clamped sampler is three's own, so only the transform patches it. Last
 * among a material's injections, as the sample replaces the map chunk's include.
 */
export function renderTargetMapInjection(userData: Record<string, unknown>): ProgramInjection | undefined {
  const sampler = userData[TARGET_MAP_KEY] as TargetMapSampler | undefined;
  if (!sampler) return undefined;
  if (!sampler.repeats && !sampler.isNearest) return TARGET_MAP_UV;
  return composeInjections([
    TARGET_MAP_UV,
    sampler.repeats ? WRAPS : undefined,
    sampler.isNearest ? NEAREST : undefined,
    TARGET_MAP_SAMPLE,
  ]);
}
