/**
 * Godot's split selection and PCF in three r186's sun-light shadow lookup, which walks two cascades
 * and takes three's own five taps. Godot picks one of up to four splits by view depth, blends into
 * the next over its last tenth, and narrows a far split's filter
 * (`scene_forward_clustered.glsl:2403-2478`, the branch without soft shadows). It samples each split
 * through `sample_directional_pcf_shadow` (`:2443`, `:2477`). `fitDirectionalShadowSplits.ts` lays
 * out the per-slot values the lookup reads.
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';
import { installFramebufferHeightUniform } from '../shadowFilter/framebufferRows.js';
import { SOFT_SHADOW_FILTER } from '../shadowFilter/softShadowFilter.js';
import { SPLIT_SLOTS } from './splitShadow.js';
import { NO_BLEND } from './fitDirectionalShadowSplits.js';

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
 * the atlas or past its far plane unshadowed (`getShadow`).
 */
const GODOT_SUN_PCF = `${SOFT_SHADOW_FILTER}
\t\tfloat godotSunShadow( sampler2DShadow atlas, vec2 atlasSize, float shadowIntensity, float shadowBias, float softShadowScale, vec4 shadowCoord ) {

\t\t\tvec3 coord = shadowCoord.xyz / shadowCoord.w;
\t\t\tcoord.z += shadowBias;

\t\t\tbool inFrustum = coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0;
\t\t\tif ( ! ( inFrustum && coord.z <= 1.0 ) ) return 1.0;

\t\t\tfloat shadow = godotPcf( atlas, ( vec2( 1.0 ) / atlasSize ) * softShadowScale, coord );
\t\t\treturn mix( 1.0, shadow, shadowIntensity );

\t\t}
`;

/**
 * The replacement. The split is the first whose far end lies past the fragment's depth, and slot 3
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

\t\tfloat getSunShadow(
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
 * Replaces three's chunk, and gives the framebuffer height uniform the filter reads to every built-in
 * lit material, for every program compiled after the call. A three release that rewrites
 * the lookup keeps its own chunk, and `splitShadowChunk.test.ts` fails on that release. A second
 * call changes nothing. The patch touches only the sun block, so it composes with the fade in
 * `shadowFade.ts` in either install order.
 */
export function installGodotSplitShadow(): void {
  if (THREE.ShaderChunk[CHUNK].includes(SPLIT_LOOKUP)) return;
  const patched = godotSplitShadowChunk(THREE.ShaderChunk[CHUNK]);
  if (patched === null) {
    warn(`[Shading] three's ${CHUNK} has no sun shadow lookup to replace`);
    return;
  }
  THREE.ShaderChunk[CHUNK] = patched;
  installFramebufferHeightUniform();
}
