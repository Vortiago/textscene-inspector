/**
 * Godot's alpha antialiasing in three's programs: a cutout cuts at its scissor, then ramps its alpha
 * across one pixel at the edge (`scene_forward_clustered.glsl:1383-1424`), which alpha to coverage
 * turns into sample coverage under MSAA and the blend turns into a soft edge without it.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedOn } from './recordedOnMaterial';
import {
  turnsOnAlphaToCoverage,
  type AlphaAntialiasingCut,
} from '../../godot/rendering/materials/alphaAntialiasing';
import { alphaToCoverageBlendState } from '../../resources/materials/standardmaterial3d/blendState';
import type { MaterialBlendState } from '../../resources/materials/standardmaterial3d/types';
import { ALPHA_HASH_CHUNK, ALPHA_TEST_CHUNK } from './surfaceAlphaPatch';

const ALPHA_TEST_PARS_CHUNK = '#include <alphatest_pars_fragment>';

/**
 * `calc_mip_level` and `compute_alpha_antialiasing_edge` (`scene_forward_aa_inc.glsl:45-56`), the
 * ramp split out as a scalar function of the alpha and its screen-space width.
 */
const EDGE_FUNCTIONS = /* glsl */ `
uniform float godotAlphaScissorThreshold;
uniform float godotAlphaAntialiasingEdge;
uniform vec2 godotAlbedoTextureSize;
uniform int godotSingleSampleCoverage;
float godotAlphaMipLevel( vec2 textureCoordinate ) {
	vec2 dx = dFdx( textureCoordinate );
	vec2 dy = dFdy( textureCoordinate );
	return max( 0.0, 0.5 * log2( max( dot( dx, dx ), dot( dy, dy ) ) ) );
}
float godotEdgeCoverage( float alpha, float alphaWidth, float edge ) {
	return clamp( ( alpha - edge ) / max( alphaWidth, 0.0001 ) + 0.5, 0.0, 1.0 );
}
`;

/**
 * The ramp, after the hash. `ALPHA_TEXTURE_COORDINATE` is the UV in texels (`material.cpp:1846`).
 * With no albedo texture, or a map whose image has not loaded, its size is zero, which makes the
 * mip level `log2(0)`. That is undefined in GLSL, so the ramp skips the mip term there, as the -inf
 * it gives on Godot's drivers does.
 */
const EDGE_RAMP = /* glsl */ `
	float godotEdgeAlpha = diffuseColor.a;
	#ifdef USE_MAP
		if ( godotAlbedoTextureSize.x > 0.0 ) {
			godotEdgeAlpha *= 1.0 + godotAlphaMipLevel( vMapUv * godotAlbedoTextureSize ) * 0.25;
		}
	#endif
	diffuseColor.a = godotEdgeCoverage( godotEdgeAlpha, fwidth( godotEdgeAlpha ), godotAlphaAntialiasingEdge );
`;

/**
 * Alpha to coverage on a target with one sample, where WebGL skips it (GLES 3.0.6 §4.1.3). Vulkan
 * leaves the one-sample mask to the implementation, so the sample is covered from alpha 0.5, the
 * mean of a dithered mask. The uniform holds the mode, and alpha to one forces the alpha after.
 */
const SINGLE_SAMPLE_COVERAGE = /* glsl */ `
	if ( godotSingleSampleCoverage > 0 ) {
		if ( diffuseColor.a < 0.5 ) discard;
		if ( godotSingleSampleCoverage == 2 ) diffuseColor.a = 1.0;
	}
`;

const SCISSOR_CUT = /* glsl */ `if ( diffuseColor.a < godotAlphaScissorThreshold ) discard;`;

/** Where a material records its alpha antialiasing. */
const ALPHA_ANTIALIASING_KEY = 'godotAlphaAntialiasing';

/** Where a material records how many of Godot's albedo texels one texel of its map holds. */
const ALBEDO_TEXTURE_SCALE_KEY = 'godotAlbedoTextureScale';

/**
 * The `userData` that gives a material its alpha antialiasing: nothing for none. `albedoTextureScale`
 * converts the map's size into the `albedo_texture_size` Godot's mip term reads, for a map drawn at
 * another resolution than Godot's texture.
 */
export function alphaAntialiasingUserData(
  cut: AlphaAntialiasingCut | null,
  albedoTextureScale = 1
): Record<string, AlphaAntialiasingCut | number> {
  return cut ? { [ALPHA_ANTIALIASING_KEY]: cut, [ALBEDO_TEXTURE_SCALE_KEY]: albedoTextureScale } : {};
}

/** The alpha antialiasing a material, or the props it is built from, records, or null for none. */
export function alphaAntialiasingOf(material: Pick<THREE.Material, 'userData'>): AlphaAntialiasingCut | null {
  return recordedOn<AlphaAntialiasingCut | null>(material, ALPHA_ANTIALIASING_KEY, null);
}

/** The colour-pass state a cut turns on beside the ramp: alpha to coverage, and the blend it brings. */
export function alphaAntialiasingProps(
  cut: AlphaAntialiasingCut | null
): Partial<MaterialBlendState> & { alphaToCoverage?: true } {
  if (!cut || !turnsOnAlphaToCoverage(cut.mode)) return {};
  return { alphaToCoverage: true, ...alphaToCoverageBlendState(cut.mode) };
}

/** Each context's `antialias` attribute, fixed for the context's life. Collected with it. */
const canvasAntialias = new WeakMap<WebGLRenderingContext | WebGL2RenderingContext, boolean>();

/** Whether the renderer draws into a target with more than one sample per pixel. */
function drawsMultisampled(renderer: THREE.WebGLRenderer): boolean {
  const target = renderer.getRenderTarget();
  if (target) return target.samples > 0;
  const context = renderer.getContext();
  let antialias = canvasAntialias.get(context);
  if (antialias === undefined) {
    antialias = context.getContextAttributes()?.antialias === true;
    canvasAntialias.set(context, antialias);
  }
  return antialias;
}

/** The uniforms of one antialiased material's program. */
interface EdgeUniforms extends Record<string, THREE.IUniform> {
  godotSingleSampleCoverage: THREE.IUniform<number>;
}

/**
 * Each antialiased material's uniforms. The getters read at upload, so a re-parsed edge or a texture
 * that lands later needs no recompile. Collected with its material.
 */
const edgeUniforms = new WeakMap<THREE.Material, EdgeUniforms>();

function edgeUniformsOf(material: THREE.Material & { map?: THREE.Texture | null }): EdgeUniforms {
  let uniforms = edgeUniforms.get(material);
  if (!uniforms) {
    const textureSize = new THREE.Vector2();
    uniforms = {
      godotAlphaScissorThreshold: {
        get value() {
          return alphaAntialiasingOf(material)?.scissorThreshold ?? 0;
        },
      },
      godotAlphaAntialiasingEdge: {
        get value() {
          return alphaAntialiasingOf(material)?.edge ?? 0;
        },
      },
      godotAlbedoTextureSize: {
        get value() {
          const image = material.map?.image as { width?: number; height?: number } | undefined;
          const scale = recordedOn(material, ALBEDO_TEXTURE_SCALE_KEY, 1);
          return textureSize.set(image?.width ?? 0, image?.height ?? 0).multiplyScalar(scale);
        },
      },
      godotSingleSampleCoverage: { value: 0 },
    };
    edgeUniforms.set(material, uniforms);
  }
  return uniforms;
}

/**
 * What every material that records alpha antialiasing runs before each draw: the coverage
 * `SINGLE_SAMPLE_COVERAGE` emulates, for the target three draws into now. A depth or shadow copy
 * turns no alpha to coverage on, so it never emulates it.
 */
export function coverOneSampleTarget(this: THREE.Material, renderer: THREE.WebGLRenderer): void {
  const coversOneSample = this.alphaToCoverage && !drawsMultisampled(renderer);
  edgeUniformsOf(this).godotSingleSampleCoverage.value = coversOneSample
    ? (alphaAntialiasingOf(this)?.mode ?? 0)
    : 0;
}

/**
 * What every material that records alpha antialiasing compiles with. three's own cut moves after
 * the ramp, where Godot's depth draws cut at `opaque_prepass_threshold`. The colour pass sets no
 * `alphaTest`, so there it cuts nothing.
 */
export const GODOT_ALPHA_ANTIALIASING: ProgramInjection = {
  cacheKey: 'godot-alpha-antialiasing',
  onBeforeCompile(shader) {
    // Both chunks or neither: the scissor replaces three's cut, which returns only after the hash.
    const { fragmentShader } = shader;
    if (!fragmentShader.includes(ALPHA_TEST_CHUNK) || !fragmentShader.includes(ALPHA_HASH_CHUNK)) return;
    Object.assign(shader.uniforms, edgeUniformsOf(this));
    shader.fragmentShader = shader.fragmentShader
      .replace(ALPHA_TEST_PARS_CHUNK, `${ALPHA_TEST_PARS_CHUNK}\n${EDGE_FUNCTIONS}`)
      .replace(ALPHA_TEST_CHUNK, SCISSOR_CUT)
      .replace(
        ALPHA_HASH_CHUNK,
        `${ALPHA_HASH_CHUNK}\n${EDGE_RAMP}${SINGLE_SAMPLE_COVERAGE}\t${ALPHA_TEST_CHUNK}`
      );
  },
};
