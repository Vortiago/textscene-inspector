/**
 * Godot's omni and spot shadow lookups in three r186's chunks. Every omni and spot shadow samples one
 * atlas through one sampler, as Godot's do (`scene_forward_clustered_inc.glsl:372`), where three binds
 * a sampler per shadow. The lookups move the receiver as Godot's do (`positionalShadowLookup.ts`).
 */

import {
  applyChunkEdits,
  installChunkPatch,
  type ChunkEdit,
  type Chunks,
} from '../shaderPatch/chunkPatch.js';
import { installLitUniform } from '../shaderPatch/litUniform.js';
import { installSoftShadowFilter } from '../shadowFilter/softShadowFilter.js';
import { ATLAS_SAMPLING, OMNI_LOOKUP, SPOT_LOOKUP } from './positionalShadowLookup.js';
import { POSITIONAL_SHADOW_ATLAS_UNIFORM, positionalShadowAtlasDepth } from './shadowAtlasTarget.js';

type PositionalChunkName =
  'shadowmap_vertex' | 'shadowmap_pars_fragment' | 'lights_fragment_begin' | 'shadowmask_pars_fragment';

/** The omni lookup of a lit fragment, `i` the light's index. */
const OMNI_SHADOW = (shadow: string, localNormal: string) =>
  `godotOmniShadow( pointShadowMatrix[ i ], vPointShadowCoord[ i ].xyz, ${localNormal}, ${shadow} )`;

/**
 * Each edit, in the order the chunks are read. Each `three` text occurs once in its chunk, as three's
 * build holds it: without blank lines or comments.
 */
export const POSITIONAL_SHADOW_EDITS: readonly ChunkEdit<PositionalChunkName>[] = [
  {
    chunk: 'shadowmap_vertex',
    three: `			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;`,
    godot: `			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * worldPosition;`,
  },
  {
    chunk: 'shadowmap_vertex',
    three: `		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
`,
    godot: '',
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];`,
    // The vertex stage declares it highp, and a uniform's precision must match across stages.
    godot: `	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
	uniform highp mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
`,
    godot: `	#if NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0
${ATLAS_SAMPLING}
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];`,
    godot: `		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
${SPOT_LOOKUP}`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
`,
    // The vertex stage declares it highp, and a uniform's precision must match across stages.
    godot: `		uniform highp mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];`,
    godot: `		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
${OMNI_LOOKUP}`,
  },
  {
    chunk: 'lights_fragment_begin',
    three: `		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;`,
    godot: `		directLight.color *= ( directLight.visible && receiveShadow ) ? ${OMNI_SHADOW('pointLightShadow', 'godotOmniLocalNormal( pointShadowMatrix[ i ], normal )')} : 1.0;`,
  },
  {
    chunk: 'lights_fragment_begin',
    three:
      'getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] )',
    godot:
      'godotSpotShadow( godotSpotShadowCoord( vSpotLightCoord[ i ], spotLightMatrix[ i ], spotLight.position - geometryPosition, normal, spotLightShadow.shadowNormalBias, spotLightShadow.shadowBias ), spotLightShadow.shadowRadius, spotLightShadow.shadowIntensity )',
  },
  // `ShadowMaterial` has no normal, so its lookups move the receiver by the depth bias alone.
  {
    chunk: 'shadowmask_pars_fragment',
    three:
      'getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] )',
    godot:
      'godotSpotShadow( godotSpotDepthBias( vSpotLightCoord[ i ], spotLight.shadowBias ), spotLight.shadowRadius, spotLight.shadowIntensity )',
  },
  {
    chunk: 'shadowmask_pars_fragment',
    three:
      'getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar )',
    godot: OMNI_SHADOW('pointLight', 'vec3( 0.0 )'),
  },
];

export type PositionalShadowChunks = Chunks<PositionalChunkName>;

/**
 * The chunks with every edit applied, or null when an edit's text is missing from its chunk or
 * occurs more than once.
 */
export function positionalShadowChunks(chunks: PositionalShadowChunks): PositionalShadowChunks | null {
  return applyChunkEdits(chunks, POSITIONAL_SHADOW_EDITS);
}

/**
 * Installs the soft shadow filter, then replaces three's chunks and gives the atlas uniform to every
 * built-in lit material and to `UniformsLib.lights`, for every program compiled after the call. A
 * three release that rewrites any edited text keeps all its own chunks, and
 * `positionalShadowChunk.test.ts` fails on that release. A second call changes nothing.
 */
export function installGodotPositionalShadow(): void {
  if (!installSoftShadowFilter()) return;
  const isPatched = installChunkPatch({
    names: [
      'shadowmap_vertex',
      'shadowmap_pars_fragment',
      'lights_fragment_begin',
      'shadowmask_pars_fragment',
    ],
    isApplied: (chunks) => chunks.lights_fragment_begin.includes('godotOmniShadow('),
    apply: positionalShadowChunks,
    missing: 'omni and spot shadow lookups lack a line the Godot lookups replace',
  });
  if (isPatched) installLitUniform(POSITIONAL_SHADOW_ATLAS_UNIFORM, positionalShadowAtlasDepth());
}
