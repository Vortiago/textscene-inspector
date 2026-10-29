/**
 * Godot's ALPHA_HASH in three's programs. Both hash Wyman's way, but Godot hashes at the material's
 * `alpha_hash_scale` and in the node's object space, where three hashes at 0.05 and in the mesh's
 * own vertex space.
 */

import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';
import { SHADER_ALPHA_HASH_SCALE_DEFAULT } from '../../godot/rendering/materials/defaultMaterial';
import { recordedUniform } from './recordedOnMaterial';
import { NODE_POSE_PARS, nodePoseUniforms } from './nodePose';

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
 * moves three's model away from the node's, and `godotObjectFromModel` maps it back (`nodePose.ts`).
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

/** The `userData` that gives a material its `alpha_hash_scale`. */
export function alphaHashScaleUserData(scale: number): Record<string, number> {
  return { [ALPHA_HASH_SCALE_KEY]: scale };
}

/** What every `alphaHash` material compiles with, which `materialProgramInputs` adds itself. */
export const GODOT_ALPHA_HASH: ProgramInjection = {
  cacheKey: 'godot-alpha-hash',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, nodePoseUniforms(this), {
      [ALPHA_HASH_SCALE_KEY]: recordedUniform(this, ALPHA_HASH_SCALE_KEY, SHADER_ALPHA_HASH_SCALE_DEFAULT),
    });
    const position = `${PROJECT_VERTEX_CHUNK}\n${GODOT_OBJECT_POSITION}`;
    editedProgram(
      shader,
      {
        vertex: [{ three: PROJECT_VERTEX_CHUNK, godot: position }],
        fragment: [{ three: HASH_PARS_CHUNK, godot: GODOT_HASH_THRESHOLD }],
      },
      'alpha hash'
    );
    shader.vertexShader = `${NODE_POSE_PARS}${shader.vertexShader}`;
  },
};
