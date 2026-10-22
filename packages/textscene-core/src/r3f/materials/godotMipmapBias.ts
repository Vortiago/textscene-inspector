/**
 * Godot's `texture_mipmap_bias` in three's programs. Godot builds the samplers of every 3D material
 * in a viewport with the bias as their mip level offset, on the four mipmapped filters only
 * (`material_storage.cpp:2454-2502`). WebGL2 has no per-sampler bias, so a program samples each such
 * slot with `texture(sampler, uv, bias)` from one shared uniform. A pass writes it as it renders.
 * A pass that draws 3D materials and skips `renderWithMipmapBias` samples at the last value written.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { samplesMipChain } from '../../resources/textures/godotTextureFilter';

const BIAS_UNIFORM = 'godotMipmapBias';
const SAMPLE_HELPER = 'godotMipmapBiased';

/**
 * The slots Godot's materials read through the viewport's samplers, under three's names: a
 * StandardMaterial3D's textures and the ones a glTF import adds. A lightmap has a sampler of its own,
 * and the displacement map is a vertex read.
 */
const BIASED_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'emissiveMap',
  'metalnessMap',
  'roughnessMap',
  'normalMap',
  'anisotropyMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
  'transmissionMap',
  'thicknessMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
] as const;

const BIASED_SAMPLES = new RegExp(String.raw`texture2D\(\s*(${BIASED_SLOTS.join('|')})\s*,`, 'g');
/** three's own pattern for a chunk include (`WebGLProgram.js`). */
const INCLUDE = /^[ \t]*#include +<([\w./]+)>/gm;

/** Shared by every program, so one write reaches every material. Written only by this module. */
const biasUniform: THREE.IUniform<number> = { value: 0 };

/**
 * The bias of the pass rendering now, or null for a render of the main view. Written only by
 * `renderWithMipmapBias`.
 */
let activePassBias: number | null = null;

/** Runs `render` with `bias` as the bias of every program it draws: a SubViewport's pass. */
export function renderWithMipmapBias(bias: number, render: () => void): void {
  const previousPassBias = activePassBias;
  const previousValue = biasUniform.value;
  activePassBias = bias;
  biasUniform.value = bias;
  try {
    render();
  } finally {
    activePassBias = previousPassBias;
    biasUniform.value = previousValue;
  }
}

/**
 * Sets the bias for a render of a scene the main view draws, which takes the root viewport's
 * `rootBias`. A SubViewport pass that renders the same scene keeps its own bias.
 */
export function writeMainViewMipmapBias(rootBias: number): void {
  biasUniform.value = activePassBias ?? rootBias;
}

const SAMPLER_FUNCTION = /* glsl */ `
uniform float ${BIAS_UNIFORM};
vec4 ${SAMPLE_HELPER}( sampler2D sampler, vec2 uv ) {
	return texture2D( sampler, uv, ${BIAS_UNIFORM} );
}
`;

/** `source` with every biased slot's sample routed through the helper. */
function biasedSamples(source: string): string {
  return source.replace(BIASED_SAMPLES, (_, slot: string) => `${SAMPLE_HELPER}( ${slot},`);
}

/**
 * `source` with each chunk that samples a biased slot inlined, since `onBeforeCompile` sees only
 * the `#include`. A chunk without such a sample stays an include, which a later patch matches.
 */
function inlineBiasedChunks(source: string): string {
  return source.replace(INCLUDE, (include, name: string) => {
    const chunk = THREE.ShaderChunk[name as keyof typeof THREE.ShaderChunk];
    if (chunk === undefined) return include;
    const biased = biasedSamples(chunk);
    return biased === chunk ? include : inlineBiasedChunks(biased);
  });
}

const GODOT_MIPMAP_BIAS: ProgramInjection = {
  cacheKey: 'godot-mipmap-bias',
  onBeforeCompile(shader) {
    shader.uniforms[BIAS_UNIFORM] = biasUniform;
    shader.fragmentShader = SAMPLER_FUNCTION + biasedSamples(inlineBiasedChunks(shader.fragmentShader));
  },
};

/** The `userData` key of a material that draws through a viewport's 3D samplers. */
const VIEWPORT_SAMPLERS_KEY = 'godotViewportSamplers';

/**
 * The `userData` a 3D material records, so the bias reaches it. A canvas item draws through
 * the default samplers, which carry none.
 */
export function viewportSamplersUserData(): Record<string, unknown> {
  return { [VIEWPORT_SAMPLERS_KEY]: true };
}

/** What the bias reads of a material, or of the props that build one: its `userData` and its texture slots. */
type MaterialBiasState = { userData?: unknown } & Partial<
  Record<(typeof BIASED_SLOTS)[number], THREE.Texture | null>
>;

/**
 * The injection a material's state asks for: the bias, when it records the viewport samplers and a
 * biased slot samples a mip chain. A material without a mip chain is not changed by a bias.
 */
export function mipmapBiasInjection(state: MaterialBiasState): ProgramInjection | undefined {
  const { userData } = state;
  if (typeof userData !== 'object' || userData === null) return undefined;
  if ((userData as Record<string, unknown>)[VIEWPORT_SAMPLERS_KEY] !== true) return undefined;
  // Indexed, not `.some`: no closure per material per render.
  for (let i = 0; i < BIASED_SLOTS.length; i++) {
    const texture = state[BIASED_SLOTS[i]!];
    if (texture?.isTexture === true && samplesMipChain(texture)) return GODOT_MIPMAP_BIAS;
  }
  return undefined;
}
