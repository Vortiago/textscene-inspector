/**
 * Godot's ALPHA_HASH in three's programs. Both hash Wyman's way, but Godot hashes at the material's
 * `alpha_hash_scale` and in the node's object space, where three hashes at 0.05 and in the mesh's
 * own vertex space.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedOn } from './recordedOnMaterial';

const HASH_PARS_CHUNK = '#include <alphahash_pars_fragment>';
const PROJECT_VERTEX_CHUNK = '#include <project_vertex>';

/**
 * `compute_alpha_hash_threshold` (`scene_forward_aa_inc.glsl:12-39`) at the material's scale
 * (`material.cpp:1840`), under three's name, so `alphahash_fragment` calls it.
 */
const GODOT_HASH_THRESHOLD = /* glsl */ `
#ifdef USE_ALPHAHASH
uniform float godotAlphaHashScale;
float hash2D( vec2 p ) {
	return fract( 1.0e4 * sin( 17.0 * p.x + 0.1 * p.y ) * ( 0.1 + abs( sin( 13.0 * p.y + p.x ) ) ) );
}
float hash3D( vec3 p ) {
	return hash2D( vec2( hash2D( p.xy ), p.z ) );
}
float getAlphaHashThreshold( vec3 pos ) {
	float deltaMax = max( length( dFdx( pos ) ), length( dFdy( pos ) ) );
	float pixScale = 1.0 / ( godotAlphaHashScale * deltaMax );
	vec2 pixScales = vec2( exp2( floor( log2( pixScale ) ) ), exp2( ceil( log2( pixScale ) ) ) );
	vec2 aThresh = vec2( hash3D( floor( pixScales.x * pos ) ), hash3D( floor( pixScales.y * pos ) ) );
	float lerpFactor = fract( log2( pixScale ) );
	float aInterp = ( 1.0 - lerpFactor ) * aThresh.x + lerpFactor * aThresh.y;
	float minLerp = min( lerpFactor, 1.0 - lerpFactor );
	vec3 cases = vec3(
		aInterp * aInterp / ( 2.0 * minLerp * ( 1.0 - minLerp ) ),
		( aInterp - 0.5 * minLerp ) / ( 1.0 - minLerp ),
		1.0 - ( ( 1.0 - aInterp ) * ( 1.0 - aInterp ) / ( 2.0 * minLerp * ( 1.0 - minLerp ) ) ) );
	float threshold = ( aInterp < ( 1.0 - minLerp ) ) ? ( ( aInterp < minLerp ) ? cases.x : cases.y ) : cases.z;
	return clamp( threshold, 0.00001, 1.0 );
}
#endif
`;

/**
 * Godot's `object_pos` (`scene_forward_clustered.glsl:1399`): the vertex after skinning, through a
 * multimesh instance's transform, in the node's object space. A pose the draw hooks give the draw
 * moves three's model away from the node's, and `godotObjectFromModel` maps it back.
 */
const GODOT_OBJECT_POSITION = /* glsl */ `
#ifdef USE_ALPHAHASH
	vec4 godotObjectPosition = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		godotObjectPosition = instanceMatrix * godotObjectPosition;
	#endif
	vPosition = ( godotObjectFromModel * godotObjectPosition ).xyz;
#endif
`;

/** Where a material records its `alpha_hash_scale`. */
const ALPHA_HASH_SCALE_KEY = 'godotAlphaHashScale';

/** `ALPHA_HASH_SCALE`'s value where no material sets it (`scene_forward_clustered.glsl:1303`). */
const DEFAULT_ALPHA_HASH_SCALE = 1;

/** The `userData` that gives a material its `alpha_hash_scale`. */
export function alphaHashScaleUserData(scale: number): Record<string, number> {
  return { [ALPHA_HASH_SCALE_KEY]: scale };
}

function alphaHashScaleOf(material: THREE.Material): number {
  return recordedOn(material, ALPHA_HASH_SCALE_KEY, DEFAULT_ALPHA_HASH_SCALE);
}

/** The uniforms of one hashed material's program. */
interface HashUniforms {
  godotObjectFromModel: THREE.IUniform<THREE.Matrix4>;
  godotAlphaHashScale: THREE.IUniform<number>;
}

/**
 * Each hashed material's uniforms. Written by the draw hooks before each draw, and collected with
 * its material.
 */
const hashUniforms = new WeakMap<THREE.Material, HashUniforms>();

function hashUniformsOf(material: THREE.Material): HashUniforms {
  let uniforms = hashUniforms.get(material);
  if (!uniforms) {
    uniforms = {
      godotObjectFromModel: { value: new THREE.Matrix4() },
      godotAlphaHashScale: { value: alphaHashScaleOf(material) },
    };
    hashUniforms.set(material, uniforms);
  }
  return uniforms;
}

/** What every `alphaHash` material compiles with, which `materialProgramInputs` adds itself. */
export const GODOT_ALPHA_HASH: ProgramInjection = {
  cacheKey: 'godot-alpha-hash',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, hashUniformsOf(this));
    shader.vertexShader = `uniform mat4 godotObjectFromModel;\n${shader.vertexShader.replace(
      PROJECT_VERTEX_CHUNK,
      `${PROJECT_VERTEX_CHUNK}\n${GODOT_OBJECT_POSITION}`
    )}`;
    shader.fragmentShader = shader.fragmentShader.replace(HASH_PARS_CHUNK, GODOT_HASH_THRESHOLD);
  },
};

/**
 * Points the hash of `material`'s next draw at the node's object space and the material's scale:
 * `nodeMatrixWorld` is the node's model as Godot holds it, and `modelMatrix` the one three draws
 * with. A material that hashes nothing is left alone.
 */
export function alignAlphaHash(
  material: THREE.Material,
  nodeMatrixWorld: THREE.Matrix4,
  modelMatrix: THREE.Matrix4
): void {
  const uniforms = hashUniforms.get(material);
  if (!uniforms) return;
  uniforms.godotObjectFromModel.value.copy(nodeMatrixWorld).invert().multiply(modelMatrix);
  uniforms.godotAlphaHashScale.value = alphaHashScaleOf(material);
}
