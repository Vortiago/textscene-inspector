/**
 * Godot's split selection, PCF and soft shadow in three r186's sun-light shadow lookup, which walks
 * two cascades and takes three's own five taps. Godot picks one of up to four splits by view depth,
 * blends into the next over its last tenth, and narrows a far split's filter
 * (`scene_forward_clustered.glsl:2403-2478`, the branch without soft shadows). It samples each split
 * through `sample_directional_pcf_shadow` (`:2443`, `:2477`). A sun with an angular distance takes
 * the branch with soft shadows instead (`:2310-2398`). `fitDirectionalShadowSplits.ts` lays out the
 * per-slot values the lookup reads.
 */

import { installChunkPatch, onChunk } from '../shaderPatch/chunkPatch.js';
import { installSoftShadowFilter } from '../shadowFilter/softShadowFilter.js';
import { SPLIT_SLOTS } from './splitShadow.js';
import { NO_BLEND } from './fitDirectionalShadowSplits.js';
import { DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM } from './shadowAtlas.js';
import { installSunSoftShadowUniforms, SUN_RANGE_BEGINS, SUN_SOFT_SHADOWS } from './sunSoftShadow.js';
import { DIRECTIONAL_SOFT_SHADOWS } from '../shadowFilter/softShadowSearch.js';

const CHUNK = 'shadowmap_pars_fragment';

const THREE_SLOT_COUNT = '#define SUN_LIGHT_CASCADES 2';

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
 * Godot's PCF of one split (`:2443`). Its pixel size is the atlas texel times `soft_shadow_scale`
 * times the split's blur factor, and `shadowMapSize` is the whole atlas
 * (`WebGLLights.js:305`, `splitShadow.ts`). It keeps three's test that leaves a receiver outside
 * the atlas or past its far plane unshadowed (`getShadow`). `godotPcf` is the soft shadow filter,
 * which `installSoftShadowFilter` puts ahead of the sun block.
 */
const GODOT_SUN_PCF = `
\t\tfloat godotSunShadow( sampler2DShadow atlas, vec2 atlasSize, float shadowIntensity, float shadowBias, float softShadowScale, vec4 shadowCoord ) {

\t\t\tvec3 coord = shadowCoord.xyz / shadowCoord.w;
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
 * Godot's directional soft shadows (`../shadowFilter/softShadowSearch.ts`). Each split
 * searches its own box for blockers (`sample_directional_soft_shadow`,
 * `scene_forward_lights_inc.glsl:381-424`) over a radius that grows with the receiver's distance from
 * the box's light side (`sunSoftShadow.ts`). The box's size in the atlas, Godot's `uv_scale`, is the
 * length of the slot matrix's x and y rows. Godot measures that distance in view space from a range
 * start in world space, so it moves with the camera, and so does this. A blending light blends each
 * split over the whole split before it, from the camera for the first. The depth grows away from the
 * light, where Godot's reversed depth shrinks, so a blocker is a smaller depth.
 */
const GODOT_SUN_SOFT_SHADOW = `
\t\t${SOFT_SHADOW_BLOCK}
\t\tuniform sampler2D ${DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM};
\t\tuniform vec4 ${SUN_SOFT_SHADOWS}[ NUM_SUN_LIGHT_SHADOWS ];
\t\tuniform vec4 ${SUN_RANGE_BEGINS}[ NUM_SUN_LIGHT_SHADOWS ];
\t\tfloat godotSunBlockerShadow( sampler2DShadow atlas, vec3 coord, vec2 texScale ) {
\t\t\tmat2 rotation = godotDiskRotation();
\t\t\tfloat blockerSum = 0.0;
\t\t\tfloat blockerCount = 0.0;
\t\t\tfor ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
\t\t\t\tvec2 uv = coord.xy + ( rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ] ) * texScale;
\t\t\t\tfloat blocker = godotRawDepth( ${DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM}, uv );
\t\t\t\tif ( blocker < coord.z ) {
\t\t\t\t\tblockerSum += blocker;
\t\t\t\t\tblockerCount += 1.0;
\t\t\t\t}
\t\t\t}
\t\t\tif ( blockerCount == 0.0 ) return 1.0;
\t\t\tfloat blockerAverage = blockerSum / blockerCount;
\t\t\ttexScale *= ( coord.z - blockerAverage ) / blockerAverage;
\t\t\tfloat shadow = 0.0;
\t\t\tfor ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
\t\t\t\tvec2 uv = coord.xy + ( rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ] ) * texScale;
\t\t\t\tshadow += texture( atlas, vec3( uv, coord.z ) );
\t\t\t}
\t\t\treturn shadow / float( GODOT_PENUMBRA_SHADOW_SAMPLES );
\t\t}
\t\tfloat godotSunSoftSplit( sampler2DShadow shadowMap, SunLightShadow sunLightShadow, int slot, vec4 light, float rangeBegin ) {
\t\t\tvec4 split = sunShadowCascade[ slot ];
\t\t\tmat4 matrix = sunShadowMatrix[ slot ];
\t\t\tvec2 uvScale = vec2( length( vec3( matrix[ 0 ][ 0 ], matrix[ 1 ][ 0 ], matrix[ 2 ][ 0 ] ) ), length( vec3( matrix[ 0 ][ 1 ], matrix[ 1 ][ 1 ], matrix[ 2 ][ 1 ] ) ) );
\t\t\tvec3 position = vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * split.z;
\t\t\tvec4 shadowCoord = matrix * vec4( position, 1.0 );
\t\t\tvec3 coord = shadowCoord.xyz / shadowCoord.w;
\t\t\tcoord.z += split.y;
\t\t\tbool inFrustum = coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0;
\t\t\tif ( ! ( inFrustum && coord.z <= 1.0 ) ) return 1.0;
\t\t\tfloat testRadius = ( dot( light.xyz, position - cameraPosition ) - rangeBegin ) * light.w;
\t\t\tvec2 texScale = uvScale * testRadius * sunLightShadow.shadowRadius;
\t\t\treturn mix( 1.0, godotSunBlockerShadow( shadowMap, coord, texScale ), sunLightShadow.shadowIntensity );
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
 * The replacement. `getSunShadow` takes the soft shadow for a sun with an angle, and the split
 * selection otherwise. The split is the first whose far end lies past the fragment's depth, and slot 3
 * takes everything beyond slot 2 (`:2408-2440`). Without blending, a split's filter radius scales
 * by the first split's far end over its own (`:2422-2443`). A blending split mixes in the next one
 * (`:2445-2478`), sampled only inside the band, where its weight is above zero.
 */
const GODOT_LOOKUP = `${GODOT_SUN_PCF}\t\tfloat ${SPLIT_LOOKUP}
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
\t\t\tvec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * split.z, 1.0 );

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
\t\t\t\tsunShadowMatrix[ slot ] * shadowWorldPosition
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
\t\tfloat getSunShadow(
\t\t\t#if defined( SHADOWMAP_TYPE_PCF )
\t\t\t\tsampler2DShadow shadowMap,
\t\t\t#else
\t\t\t\tsampler2D shadowMap,
\t\t\t#endif
\t\t\tSunLightShadow sunLightShadow,
\t\t\tint shadowIndex
\t\t) {

\t\t\t${SOFT_SHADOW_BLOCK}
\t\t\t\tif ( ${SUN_SOFT_SHADOWS}[ shadowIndex ].w > 0.0 ) return godotSunSoftShadow( shadowMap, sunLightShadow, shadowIndex );
\t\t\t#endif
\t\t\treturn godotSunSplitShadow( shadowMap, sunLightShadow, shadowIndex );

\t\t}
`;

/** The chunk with Godot's split lookup, or null when three's chunk no longer has the parts it replaces. */
export function godotSplitShadowChunk(chunk: string): string | null {
  const start = chunk.indexOf(THREE_LOOKUP_START);
  if (start < 0 || !chunk.includes(THREE_SLOT_COUNT)) return null;
  const end = chunk.indexOf(LOOKUP_BLOCK_END, start);
  if (end < 0) return null;
  return (chunk.slice(0, start) + GODOT_LOOKUP + chunk.slice(end)).replace(
    THREE_SLOT_COUNT,
    `#define SUN_LIGHT_CASCADES ${SPLIT_SLOTS}`
  );
}

/**
 * Installs the soft shadow filter, then replaces three's chunk, for every program compiled after the
 * call, and gives the soft shadow's arrays to every built-in lit material. A three release that rewrites the lookup keeps its own chunk, and `splitShadowChunk.test.ts`
 * fails on that release. A second call changes nothing. The patch touches only the sun block, so it
 * composes with the fade in `shadowFade.ts` in either install order.
 */
export function installGodotSplitShadow(): void {
  if (!installSoftShadowFilter()) return;
  const isPatched = installChunkPatch({
    names: [CHUNK],
    isApplied: (chunks) => chunks[CHUNK].includes(SPLIT_LOOKUP),
    apply: onChunk(CHUNK, godotSplitShadowChunk),
    missing: `${CHUNK} has no sun shadow lookup to replace`,
  });
  if (isPatched) installSunSoftShadowUniforms();
}
