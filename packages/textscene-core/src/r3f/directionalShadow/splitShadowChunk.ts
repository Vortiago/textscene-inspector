/**
 * Godot's split selection, PCF and soft shadow in three r186's sun-light shadow lookup, which walks
 * two cascades and takes three's own five taps. Godot picks one of up to four splits by view depth,
 * blends into the next over its last tenth, and narrows a far split's filter
 * (`scene_forward_clustered.glsl:2403-2478`, the branch without soft shadows). It samples each split
 * through `sample_directional_pcf_shadow` (`:2443`, `:2477`). A sun with an angular distance takes
 * the branch with soft shadows instead (`:2310-2398`). Either shadow then fades out across the far end
 * of the last split (`:2491`). `fitDirectionalShadowSplits.ts` lays out the per-slot values the lookup
 * reads.
 */

import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { installSoftShadowFilter } from '../shadowFilter/softShadowFilter.js';
import { SPLIT_SLOTS } from './splitShadow.js';
import { NO_BLEND } from './fitDirectionalShadowSplits.js';
import { DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM } from './shadowAtlas.js';
import { DIRECTIONAL_SOFT_SHADOWS } from '../shadowFilter/softShadowSearch.js';
import {
  installSunShadowUniforms,
  SLOT_MATRIX_ROWS,
  SUN_RANGE_BEGINS,
  SUN_SHADOW_FADES,
  SUN_SHADOW_ROWS,
  SUN_SOFT_SHADOWS,
} from './sunShadowUniforms.js';

const CHUNK = 'shadowmap_pars_fragment';

const THREE_SLOT_COUNT = '#define SUN_LIGHT_CASCADES 2';

/**
 * three's slot matrices take four vectors each. The rows the patch declares take three, which keeps
 * eight shadowed suns under the 224 fragment uniform vectors WebGL 2 guarantees
 * (`directionalShadow.md`, Fragment uniforms).
 */
const THREE_SLOT_MATRICES = 'uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];';
const GODOT_SLOT_ROWS = `uniform vec4 ${SUN_SHADOW_ROWS}[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES * ${SLOT_MATRIX_ROWS} ];`;

/** Where three's `getSunShadow` starts, and the line that closes its `#if` block. */
const THREE_LOOKUP_START = '\t\tfloat getSunShadow(';
const LOOKUP_BLOCK_END = '\n\t#endif';

/** The name of the per-split lookup the patch adds, which marks a chunk it has patched. */
const SPLIT_LOOKUP = 'getSunShadowSplit(';

/**
 * A slot blends while its blend start lies above this. Half of `NO_BLEND`, so the float32 rounding
 * of the uniform cannot carry the marker across it, and a negative blend start still blends.
 */
const BLENDS_ABOVE = (NO_BLEND / 2).toExponential();

/**
 * A slot's world-to-atlas matrix, read from its rows. Its fourth row is always (0, 0, 0, 1)
 * (`splitShadow.ts`), so a coordinate's w is 1. A row's length is the slot's scale along that axis.
 */
const GODOT_SLOT_MATRIX = `
\t\tvec4 godotSunShadowCoord( int slot, vec3 position ) {
\t\t\tint row = slot * ${SLOT_MATRIX_ROWS};
\t\t\tvec4 point = vec4( position, 1.0 );
\t\t\treturn vec4( dot( ${SUN_SHADOW_ROWS}[ row ], point ), dot( ${SUN_SHADOW_ROWS}[ row + 1 ], point ), dot( ${SUN_SHADOW_ROWS}[ row + 2 ], point ), 1.0 );
\t\t}
\t\tfloat godotSunShadowScale( int slot, int row ) {
\t\t\treturn length( ${SUN_SHADOW_ROWS}[ slot * ${SLOT_MATRIX_ROWS} + row ].xyz );
\t\t}
`;

/**
 * Godot's PCF of one split (`:2443`). Its pixel size is the atlas texel times `soft_shadow_scale`
 * times the split's blur factor, and `shadowMapSize` is the whole atlas
 * (`WebGLLights.js:305`, `splitShadow.ts`). It keeps three's test that leaves a receiver outside
 * the atlas or past its far plane unshadowed (`getShadow`). `godotPcf` is the soft shadow filter,
 * which `installSoftShadowFilter` puts ahead of the sun block.
 */
const GODOT_SUN_PCF = `
\t\tfloat godotSunShadow( sampler2DShadow atlas, vec2 atlasSize, float shadowIntensity, float shadowBias, float softShadowScale, vec4 shadowCoord ) {

\t\t\tvec3 coord = shadowCoord.xyz;
\t\t\tcoord.z += shadowBias;

\t\t\tbool inFrustum = coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0;
\t\t\tif ( ! ( inFrustum && coord.z <= 1.0 ) ) return 1.0;

\t\t\tfloat shadow = godotPcf( atlas, ( vec2( 1.0 ) / atlasSize ) * softShadowScale, coord );
\t\t\treturn mix( 1.0, shadow, shadowIntensity );

\t\t}
`;

/** The condition the soft shadow and its dispatch compile under. */
const SOFT_SHADOW_BLOCK = `#if defined( SHADOWMAP_TYPE_PCF ) && defined( ${DIRECTIONAL_SOFT_SHADOWS} )`;

/**
 * Godot's soft shadow of a sun with an angular distance (`:2310-2398`), under PCF shadows and
 * Godot's directional soft shadows. Each split searches its own box for blockers
 * (`sample_directional_soft_shadow`, `scene_forward_lights_inc.glsl:381-424`). `directionalShadow.md`
 * holds how it measures the search radius, the box size and the penumbra.
 */
const GODOT_SUN_SOFT_SHADOW = `
\t\t${SOFT_SHADOW_BLOCK}
\t\tuniform sampler2D ${DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM};
\t\tuniform vec4 ${SUN_SOFT_SHADOWS}[ NUM_SUN_LIGHT_SHADOWS ];
\t\tuniform vec4 ${SUN_RANGE_BEGINS}[ NUM_SUN_LIGHT_SHADOWS ];
\t\tconst float GODOT_SUN_PANCAKE = 1e-4;
\t\tfloat godotSunBlockerShadow( sampler2DShadow atlas, vec3 coord, vec2 texScale, float lightSide ) {
\t\t\tmat2 rotation = godotDiskRotation();
\t\t\tfloat blockerSum = 0.0;
\t\t\tfloat blockerCount = 0.0;
\t\t\tfloat pancaked = lightSide + GODOT_SUN_PANCAKE * ( 1.0 - lightSide );
\t\t\tfor ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
\t\t\t\tvec2 uv = coord.xy + ( rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ] ) * texScale;
\t\t\t\tfloat blocker = max( godotRawDepth( ${DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM}, uv ), pancaked );
\t\t\t\tif ( blocker < coord.z ) {
\t\t\t\t\tblockerSum += blocker;
\t\t\t\t\tblockerCount += 1.0;
\t\t\t\t}
\t\t\t}
\t\t\tif ( blockerCount == 0.0 ) return 1.0;
\t\t\tfloat blockerAverage = blockerSum / blockerCount;
\t\t\ttexScale *= ( coord.z - blockerAverage ) / ( blockerAverage - lightSide );
\t\t\tfloat shadow = 0.0;
\t\t\tfor ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
\t\t\t\tvec2 uv = coord.xy + ( rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ] ) * texScale;
\t\t\t\tshadow += texture( atlas, vec3( uv, coord.z ) );
\t\t\t}
\t\t\treturn shadow / float( GODOT_PENUMBRA_SHADOW_SAMPLES );
\t\t}
\t\tfloat godotSunSoftSplit( sampler2DShadow shadowMap, SunLightShadow sunLightShadow, int slot, vec4 light, float rangeBegin ) {
\t\t\tvec4 split = sunShadowCascade[ slot ];
\t\t\tvec2 uvScale = vec2( godotSunShadowScale( slot, 0 ), godotSunShadowScale( slot, 1 ) );
\t\t\tvec3 position = vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * split.z;
\t\t\tvec3 coord = godotSunShadowCoord( slot, position ).xyz;
\t\t\tcoord.z += split.y;
\t\t\tbool inFrustum = coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0;
\t\t\tif ( ! ( inFrustum && coord.z <= 1.0 ) ) return 1.0;
\t\t\tfloat testRadius = ( dot( light.xyz, position - cameraPosition ) - rangeBegin ) * light.w;
\t\t\tvec2 texScale = uvScale * testRadius * sunLightShadow.shadowRadius;
\t\t\tfloat lightSide = coord.z - godotSunShadowScale( slot, 2 ) * ( rangeBegin - dot( light.xyz, position ) );
\t\t\treturn mix( 1.0, godotSunBlockerShadow( shadowMap, coord, texScale, lightSide ), sunLightShadow.shadowIntensity );
\t\t}
\t\tfloat godotSunSoftShadow( sampler2DShadow shadowMap, SunLightShadow sunLightShadow, int shadowIndex ) {
\t\t\tint first = shadowIndex * SUN_LIGHT_CASCADES;
\t\t\tvec4 light = ${SUN_SOFT_SHADOWS}[ shadowIndex ];
\t\t\tfloat depth = vSunShadowWorldPosition.w;
\t\t\tint blendMax = sunShadowCascade[ first ].w > ${BLENDS_ABOVE} ? 2 : 1;
\t\t\tint blended = 0;
\t\t\tfloat shadow = 1.0;
\t\t\tfor ( int split = 0; split < SUN_LIGHT_CASCADES; split ++ ) {
\t\t\t\tif ( blended == blendMax ) break;
\t\t\t\tif ( split < SUN_LIGHT_CASCADES - 1 && ! ( depth < sunShadowCascade[ first + split ].x ) ) continue;
\t\t\t\tfloat splitShadow = godotSunSoftSplit( shadowMap, sunLightShadow, first + split, light, ${SUN_RANGE_BEGINS}[ shadowIndex ][ split ] );
\t\t\t\tif ( blended == 0 ) {
\t\t\t\t\tshadow = splitShadow;
\t\t\t\t} else {
\t\t\t\t\tfloat blendFrom = split > 1 ? sunShadowCascade[ first + max( split - 2, 0 ) ].x : 0.0;
\t\t\t\t\tshadow = mix( shadow, splitShadow, smoothstep( blendFrom, sunShadowCascade[ first + split - 1 ].x, depth ) );
\t\t\t\t}
\t\t\t\tblended ++;
\t\t\t}
\t\t\treturn shadow;
\t\t}
\t\t#endif
`;

/**
 * How far a sun's shadow fades out at the fragment's view depth, from 0 to 1 (`:2491`), between the
 * camera depths `sunShadowUniforms.ts` writes per sun. A fade whose ends do not ascend is no fade:
 * that covers a sun no fit has placed, and keeps `smoothstep` defined.
 */
const GODOT_SUN_FADE = `
\t\tuniform vec2 ${SUN_SHADOW_FADES}[ NUM_SUN_LIGHT_SHADOWS ];
\t\tfloat godotSunShadowFadeOut( int shadowIndex ) {
\t\t\tvec2 fade = ${SUN_SHADOW_FADES}[ shadowIndex ];
\t\t\treturn fade.y > fade.x ? smoothstep( fade.x, fade.y, vSunShadowWorldPosition.w ) : 0.0;
\t\t}
`;

/**
 * The replacement. `getSunShadow` takes the soft shadow for a sun with an angle, else the split
 * lookup (`:2408-2478`), and fades either out, so a fragment past the fade samples nothing.
 * `directionalShadow.md` (The split lookup) gives the split choice, filter radius and blend band.
 */
const GODOT_LOOKUP = `${GODOT_SLOT_MATRIX}${GODOT_SUN_PCF}\t\tfloat ${SPLIT_LOOKUP}
\t\t\t#if defined( SHADOWMAP_TYPE_PCF )
\t\t\t\tsampler2DShadow shadowMap,
\t\t\t#else
\t\t\t\tsampler2D shadowMap,
\t\t\t#endif
\t\t\tSunLightShadow sunLightShadow,
\t\t\tint slot,
\t\t\tfloat radiusScale
\t\t) {

\t\t\tvec4 split = sunShadowCascade[ slot ];
\t\t\tvec3 shadowWorldPosition = vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * split.z;

\t\t\t#if defined( SHADOWMAP_TYPE_PCF )
\t\t\t\treturn godotSunShadow(
\t\t\t#else
\t\t\t\treturn getShadow(
\t\t\t#endif
\t\t\t\tshadowMap,
\t\t\t\tsunLightShadow.shadowMapSize,
\t\t\t\tsunLightShadow.shadowIntensity,
\t\t\t\tsplit.y,
\t\t\t\tsunLightShadow.shadowRadius * radiusScale,
\t\t\t\tgodotSunShadowCoord( slot, shadowWorldPosition )
\t\t\t);

\t\t}

\t\tfloat godotSunSplitShadow(
\t\t\t#if defined( SHADOWMAP_TYPE_PCF )
\t\t\t\tsampler2DShadow shadowMap,
\t\t\t#else
\t\t\t\tsampler2D shadowMap,
\t\t\t#endif
\t\t\tSunLightShadow sunLightShadow,
\t\t\tint shadowIndex
\t\t) {

\t\t\tint first = shadowIndex * SUN_LIGHT_CASCADES;
\t\t\tfloat depth = vSunShadowWorldPosition.w;

\t\t\tint split = depth < sunShadowCascade[ first ].x ? 0
\t\t\t\t: depth < sunShadowCascade[ first + 1 ].x ? 1
\t\t\t\t: depth < sunShadowCascade[ first + 2 ].x ? 2
\t\t\t\t: 3;
\t\t\tvec4 selected = sunShadowCascade[ first + split ];

\t\t\tbool blendsSplits = sunShadowCascade[ first ].w > ${BLENDS_ABOVE};
\t\t\tfloat radiusScale = blendsSplits ? 1.0 : sunShadowCascade[ first ].x / selected.x;
\t\t\tfloat shadow = getSunShadowSplit( shadowMap, sunLightShadow, first + split, radiusScale );

\t\t\tif ( split < 3 && selected.w > ${BLENDS_ABOVE} && depth > selected.w ) {

\t\t\t\tfloat next = getSunShadowSplit( shadowMap, sunLightShadow, first + split + 1, 1.0 );
\t\t\t\tshadow = mix( shadow, next, smoothstep( selected.w, selected.x, depth ) );

\t\t\t}

\t\t\treturn shadow;

\t\t}
${GODOT_SUN_SOFT_SHADOW}
${GODOT_SUN_FADE}
\t\tfloat getSunShadow(
\t\t\t#if defined( SHADOWMAP_TYPE_PCF )
\t\t\t\tsampler2DShadow shadowMap,
\t\t\t#else
\t\t\t\tsampler2D shadowMap,
\t\t\t#endif
\t\t\tSunLightShadow sunLightShadow,
\t\t\tint shadowIndex
\t\t) {

\t\t\tfloat fadeOut = godotSunShadowFadeOut( shadowIndex );
\t\t\tif ( fadeOut >= 1.0 ) return 1.0;
\t\t\t${SOFT_SHADOW_BLOCK}
\t\t\t\tif ( ${SUN_SOFT_SHADOWS}[ shadowIndex ].w > 0.0 ) return mix( godotSunSoftShadow( shadowMap, sunLightShadow, shadowIndex ), 1.0, fadeOut );
\t\t\t#endif
\t\t\treturn mix( godotSunSplitShadow( shadowMap, sunLightShadow, shadowIndex ), 1.0, fadeOut );

\t\t}
`;

/** Godot's split lookup in place of three's, with the slot count and the rows it reads. */
const SPLIT_SHADOW_EDITS: readonly ChunkEdit<typeof CHUNK>[] = [
  {
    chunk: CHUNK,
    three: THREE_LOOKUP_START,
    until: LOOKUP_BLOCK_END,
    godot: GODOT_LOOKUP + LOOKUP_BLOCK_END,
  },
  { chunk: CHUNK, three: THREE_SLOT_COUNT, godot: `#define SUN_LIGHT_CASCADES ${SPLIT_SLOTS}` },
  { chunk: CHUNK, three: THREE_SLOT_MATRICES, godot: GODOT_SLOT_ROWS },
];

/**
 * Installs the soft shadow filter, then replaces three's chunk, for every program compiled after the
 * call, and gives the arrays the lookup reads to every built-in lit material. A three release that
 * rewrites the lookup keeps its own chunk, and `splitShadowChunk.test.ts` fails on that release. A
 * second call changes nothing.
 */
export function installGodotSplitShadow(): void {
  if (!installSoftShadowFilter()) return;
  const isPatched = installChunkEdits({
    edits: SPLIT_SHADOW_EDITS,
    mark: SPLIT_LOOKUP,
    patch: 'split shadow',
  });
  if (!isPatched) return;
  installSunShadowUniforms();
}
