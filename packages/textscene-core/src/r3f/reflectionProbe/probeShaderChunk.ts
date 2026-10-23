/**
 * Godot's ReflectionProbes in three's physical lighting (`scene_forward_clustered.glsl:2043-2116`,
 * `scene_forward_lights_inc.glsl:923-1003`): each probe whose box holds the fragment, and whose mask
 * the instance's layers meet, lays its capture over the reflection and its ambient over the ambient,
 * by how far inside the box the fragment lies. The smallest box claims a fragment first.
 */

import { ReflectionProbeAmbientMode } from '../../godot/rendering/environment/reflectionProbe.js';
import { MAX_ROUGHNESS_LOD } from '../../godot/rendering/environment/skyReflection.js';
import { glslFloat } from '../../utils/glslLiterals.js';
import { OCTMAP_GLSL } from '../../resources/sky/skyLayerShaders.js';
import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { installLitUniform } from '../shaderPatch/litUniform.js';
import { atlasSlot, instanceLayers, REFLECTION_PROBE_UNIFORMS, rowsSlot, shownProbes } from './probeSlots.js';

type ProbeChunk = 'lights_physical_pars_fragment' | 'lights_fragment_end';

const { atlas, rows, probes, instanceLayers: layers } = REFLECTION_PROBE_UNIFORMS;

/**
 * The probe functions, all in world space: Godot's are in view space through a matrix that folds in
 * the camera (`light_storage.cpp:1824-1825`), which gives the same local space. `probes` holds the
 * count, the atlas's border size and its last layer, past which a read would leave Godot's layers.
 */
const REFLECTION_PROBE_GLSL = /* glsl */ `
uniform highp sampler2DArray ${atlas};
uniform highp sampler2D ${rows};
uniform vec4 ${probes}[ 1 ];
uniform uint ${layers}[ 1 ];
${OCTMAP_GLSL}
vec4 godotProbeTexel( int index, int texel ) {
	return texelFetch( ${rows}, ivec2( texel, index ), 0 );
}

uint godotProbeMask( vec4 flags ) {
	return uint( flags.x ) | ( uint( flags.y ) << 16u );
}

float godotProbeAxisBlend( float position, float extent, float blendDistance ) {
	float axisBlendDistance = min( blendDistance, extent );
	return clamp( 1.0 - ( abs( position ) - extent + axisBlendDistance ) / axisBlendDistance, 0.0, 1.0 );
}

float godotBoxExit( float position, float direction, float extent ) {
	return direction > 0.0 ? ( extent - position ) / direction : ( - extent - position ) / direction;
}

vec3 godotProbeAtlasRead( vec3 direction, float layer, float lod ) {
	vec4 shown = ${probes}[ 0 ];
	vec2 uv = vec3ToOctWithBorder( direction, shown.y );
	return textureLod( ${atlas}, vec3( uv, layer ), min( lod, shown.z ) ).rgb;
}

void godotReflectionProbe( int index, vec4 flags, vec3 position, vec3 reflectVec, vec3 normal, float roughness, inout vec4 reflection, inout vec4 ambient ) {
	vec4 toLocalX = godotProbeTexel( index, 0 );
	vec4 toLocalY = godotProbeTexel( index, 1 );
	vec4 toLocalZ = godotProbeTexel( index, 2 );
	vec3 localPosition = vec3( dot( toLocalX, vec4( position, 1.0 ) ), dot( toLocalY, vec4( position, 1.0 ) ), dot( toLocalZ, vec4( position, 1.0 ) ) );
	vec4 box = godotProbeTexel( index, 3 );
	vec3 extents = box.xyz;
	if ( any( greaterThan( abs( localPosition ), extents ) ) ) return;
	float blend = 1.0;
	if ( box.w != 0.0 ) {
		blend = godotProbeAxisBlend( localPosition.x, extents.x, box.w ) * godotProbeAxisBlend( localPosition.y, extents.y, box.w ) * godotProbeAxisBlend( localPosition.z, extents.z, box.w );
		blend *= blend;
	}
	vec4 offset = godotProbeTexel( index, 4 );
	if ( offset.w > 0.0 && reflection.a < 1.0 ) {
		vec3 localReflect = vec3( dot( toLocalX.xyz, reflectVec ), dot( toLocalY.xyz, reflectVec ), dot( toLocalZ.xyz, reflectVec ) );
		if ( flags.z > 0.5 ) {
			vec3 direction = normalize( localReflect );
			float exit = min( min( godotBoxExit( localPosition.x, direction.x, extents.x ), godotBoxExit( localPosition.y, direction.y, extents.y ) ), godotBoxExit( localPosition.z, direction.z, extents.z ) );
			localReflect = localPosition + direction * exit - offset.xyz;
		}
		float weight = max( 0.0, blend - reflection.a );
		vec3 colour = godotProbeAtlasRead( localReflect, flags.w, sqrt( roughness ) * ${glslFloat(MAX_ROUGHNESS_LOD)} ) * offset.w;
		reflection += vec4( colour * weight, weight );
	}
	if ( ambient.a >= 1.0 ) return;
	vec4 probeAmbient = godotProbeTexel( index, 5 );
	int mode = int( probeAmbient.w );
	if ( mode == ${ReflectionProbeAmbientMode.DISABLED} ) return;
	vec3 colour = probeAmbient.rgb;
	if ( mode == ${ReflectionProbeAmbientMode.ENVIRONMENT} ) {
		vec3 localNormal = vec3( dot( toLocalX.xyz, normal ), dot( toLocalY.xyz, normal ), dot( toLocalZ.xyz, normal ) );
		colour = godotProbeAtlasRead( localNormal, flags.w, ${glslFloat(MAX_ROUGHNESS_LOD)} );
	}
	float weight = max( 0.0, blend - ambient.a );
	ambient += vec4( colour * weight, weight );
}

void godotGatherReflectionProbes( vec3 viewPosition, vec3 normal, vec3 viewDir, float roughness, out vec4 reflection, out vec4 ambient ) {
	reflection = vec4( 0.0 );
	ambient = vec4( 0.0 );
	int probeCount = int( ${probes}[ 0 ].x );
	if ( probeCount == 0 ) return;
	vec3 reflectVec = mix( normalize( reflect( - viewDir, normal ) ), normal, roughness * roughness * roughness * roughness );
	vec3 worldPosition = cameraPosition + ( vec4( viewPosition, 0.0 ) * viewMatrix ).xyz;
	vec3 worldReflect = ( vec4( reflectVec, 0.0 ) * viewMatrix ).xyz;
	vec3 worldNormal = ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
	for ( int index = probeCount - 1; index >= 0; index -- ) {
		vec4 flags = godotProbeTexel( index, 6 );
		if ( ( godotProbeMask( flags ) & ${layers}[ 0 ] ) == 0u ) continue;
		if ( reflection.a >= 1.0 && ambient.a >= 1.0 ) break;
		godotReflectionProbe( index, flags, worldPosition, worldReflect, worldNormal, roughness, reflection, ambient );
	}
}
`;

const THREE_INDIRECT_DIFFUSE =
  'RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

/**
 * The probes' reflection and ambient take the place of the sky's where they cover it
 * (`scene_forward_clustered.glsl:2097-2115`), after the coat dims both. A surface whose lightmap
 * draws keeps its ambient (`:2112`). three's irradiance is Godot's ambient times PI.
 */
const GATHER_PROBES = /* glsl */ `#if defined( STANDARD )
		vec4 godotProbeReflection;
		vec4 godotProbeAmbient;
		godotGatherReflectionProbes( geometryPosition, geometryNormal, geometryViewDir, material.godotRoughness, godotProbeReflection, godotProbeAmbient );
		radiance = godotProbeReflection.rgb + radiance * ( 1.0 - godotProbeReflection.a );
		#ifdef GODOT_LIGHTMAP
		if ( ! godotLightmapActive )
		#endif
		{
			irradiance *= 1.0 - godotProbeAmbient.a;
			iblIrradiance = PI * godotProbeAmbient.rgb + iblIrradiance * ( 1.0 - godotProbeAmbient.a );
		}
	#endif
	${THREE_INDIRECT_DIFFUSE}`;

const EDITS: readonly ChunkEdit<ProbeChunk>[] = [
  { chunk: 'lights_fragment_end', three: THREE_INDIRECT_DIFFUSE, godot: GATHER_PROBES },
];

/**
 * Gathers the probes in every physical program compiled after the call, and gives every built-in lit
 * material the shared slots. A three release that rewrites the replaced line keeps all its chunks,
 * and `probeShaderChunk.test.ts` fails on that release. A second call changes nothing.
 */
export function installGodotReflectionProbes(): void {
  const isPatched = installChunkEdits({
    edits: EDITS,
    mark: GATHER_PROBES,
    patch: 'reflection probe',
    append: { lights_physical_pars_fragment: REFLECTION_PROBE_GLSL },
  });
  if (!isPatched) return;
  installLitUniform(atlas, atlasSlot);
  installLitUniform(rows, rowsSlot);
  installLitUniform(probes, shownProbes);
  installLitUniform(layers, instanceLayers);
}
