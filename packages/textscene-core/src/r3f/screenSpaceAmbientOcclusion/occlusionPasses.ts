/**
 * The passes of one screen-space ambient occlusion, in Godot's order (`ss_effects.cpp:502-603`,
 * `:1130-1420`): the linear depth and its mips, Ultra's base pass and importance map, the gather of
 * each slice, the edge-aware blur, and the interleave back to the world buffer's size.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { drawPass, multipleTargetPass, namedUniformPass } from '../fullScreenPass.js';
import type { ScreenSpaceAmbientOcclusion } from '../../resources/environment/types.js';
import {
  SSAO_ROTATION_MATRICES,
  ssaoBlurModes,
  ssaoDepthLinearize,
  ssaoGatherParameters,
  ssaoInterleaveMode,
  ssaoReadsBlurredFromPong,
  type SsaoBlurMode,
  type SsaoInterleaveMode,
} from '../../godot/rendering/environment/screenSpaceAmbientOcclusion.js';
import type { PrepassBuffers } from '../screenSpaceEffects/prepassBuffers.js';
import type { AdaptiveBuffers, OcclusionBuffers } from './occlusionBuffers.js';
import {
  BLUR_FRAGMENT,
  DEPTH_DOWNSAMPLE_FRAGMENT,
  DEPTH_MIP_FRAGMENT,
  GATHER_FRAGMENT,
  IMPORTANCE_FRAGMENT,
  INTERLEAVE_FRAGMENT,
  LOAD_COUNTER_FRAGMENT,
} from './ssaoShaders.js';

/** The camera and the Environment's settings one occlusion reads, past the project's that shape its buffers. */
export interface OcclusionInputs {
  /** The camera's projection, as Godot's `cam_projection`. */
  projection: THREE.Matrix4;
  ssao: ScreenSpaceAmbientOcclusion;
}

/** Godot's compute passes run in work groups of eight by eight (`local_size_x = 8`). */
const WORK_GROUP_SIZE = 8;

const SLICE_UNIFORMS = ['source0', 'source1', 'source2', 'source3'];

const GATHER_UNIFORMS = [
  'source_depth0',
  'source_depth1',
  'source_depth2',
  'source_depth3',
  'source_normal',
  'rotation_matrices',
  'pass',
  'quality',
  'half_screen_pixel_size',
  'size_multiplier',
  'detail_intensity',
  'NDC_to_view_mul',
  'NDC_to_view_add',
  'half_screen_pixel_size_x025',
  'radius',
  'intensity',
  'shadow_power',
  'shadow_clamp',
  'fade_out_mul',
  'fade_out_add',
  'horizon_angle_threshold',
  'inv_radius_near_limit',
  'is_orthogonal',
  'neg_inv_radius',
  'load_counter_avg_div',
  'adaptive_sample_limit',
  'pass_coord_offset',
  'pass_uv_offset',
];

function withDefines(pass: THREE.ShaderMaterial, ...names: string[]): THREE.ShaderMaterial {
  pass.defines = Object.fromEntries(names.map((name) => [name, '']));
  return pass;
}

function downsamplePass(name: string, ...defines: string[]): THREE.ShaderMaterial {
  const pass = namedUniformPass(name, DEPTH_DOWNSAMPLE_FRAGMENT, [
    'source_depth',
    'z_far',
    'z_near',
    'orthogonal',
  ]);
  return withDefines(multipleTargetPass(pass), ...defines);
}

function gatherPass(name: string, ...defines: string[]): THREE.ShaderMaterial {
  const adaptive = defines.includes('ADAPTIVE') ? ['source_ssao', 'source_importance', 'load_counter'] : [];
  return withDefines(namedUniformPass(name, GATHER_FRAGMENT, [...GATHER_UNIFORMS, ...adaptive]), ...defines);
}

function blurPass(name: string, mode: string): THREE.ShaderMaterial {
  const uniforms = ['source_ssao', 'edge_sharpness', 'half_screen_pixel_size'];
  return withDefines(namedUniformPass(name, BLUR_FRAGMENT, uniforms), mode);
}

function interleavePass(name: string, mode: string): THREE.ShaderMaterial {
  const uniforms = [...SLICE_UNIFORMS, 'inv_sharpness', 'size_modifier', 'pixel_size'];
  return withDefines(namedUniformPass(name, INTERLEAVE_FRAGMENT, uniforms), mode);
}

function importancePass(name: string, mode: string): THREE.ShaderMaterial {
  const sources = mode === 'GENERATE_MAP' ? SLICE_UNIFORMS : ['source_importance'];
  const uniforms = [...sources, 'half_screen_pixel_size', 'intensity', 'power'];
  return withDefines(namedUniformPass(name, IMPORTANCE_FRAGMENT, uniforms), mode);
}

/** One set of passes per renderer, as each pass is (`fullScreenPass.ts`). */
const passesOf = perObject((_renderer: THREE.WebGLRenderer) => ({
  /** By whether the slices are half buffers, then by whether each reads every fourth depth texel. */
  downsample: {
    plain: {
      fullSize: downsamplePass('SsaoDownsample'),
      halfSize: downsamplePass('SsaoDownsampleHalfSize', 'USE_HALF_SIZE'),
    },
    halfBuffers: {
      fullSize: downsamplePass('SsaoDownsampleHalfBuffers', 'USE_HALF_BUFFERS'),
      halfSize: downsamplePass('SsaoDownsampleHalfBuffersHalfSize', 'USE_HALF_BUFFERS', 'USE_HALF_SIZE'),
    },
  },
  mip: multipleTargetPass(
    namedUniformPass('SsaoDepthMip', DEPTH_MIP_FRAGMENT, [...SLICE_UNIFORMS, 'keepsCorner'])
  ),
  gather: gatherPass('SsaoGather'),
  gatherBase: gatherPass('SsaoGatherBase', 'SSAO_BASE'),
  gatherAdaptive: gatherPass('SsaoGatherAdaptive', 'ADAPTIVE'),
  blur: {
    nonSmart: blurPass('SsaoBlur', 'MODE_NON_SMART'),
    smart: blurPass('SsaoBlurSmart', 'MODE_SMART'),
    wide: blurPass('SsaoBlurWide', 'MODE_WIDE'),
  } satisfies Record<SsaoBlurMode, THREE.ShaderMaterial>,
  interleave: {
    nonSmart: interleavePass('SsaoInterleave', 'MODE_NON_SMART'),
    smart: interleavePass('SsaoInterleaveSmart', 'MODE_SMART'),
    half: interleavePass('SsaoInterleaveHalf', 'MODE_HALF'),
  } satisfies Record<SsaoInterleaveMode, THREE.ShaderMaterial>,
  importance: {
    generate: importancePass('SsaoImportance', 'GENERATE_MAP'),
    processA: importancePass('SsaoImportanceA', 'PROCESS_MAPA'),
    processB: importancePass('SsaoImportanceB', 'PROCESS_MAPB'),
  },
  loadCounter: namedUniformPass('SsaoLoadCounter', LOAD_COUNTER_FRAGMENT, [
    'source_importance',
    'half_screen_pixel_size',
    'groups',
  ]),
}));

type Passes = ReturnType<typeof passesOf>;

/** The four slices `textures` as the slice uniforms of a pass. */
function slicesOf(textures: readonly THREE.Texture[]): Record<string, THREE.Texture> {
  return Object.fromEntries(SLICE_UNIFORMS.map((name, slice) => [name, textures[slice]!]));
}

const texturesOf = (targets: readonly THREE.WebGLRenderTarget[]) => targets.map((target) => target.texture);

/**
 * Draws the occlusion of the frame whose prepass `prepass` holds into `buffers.occlusion`. The
 * caller restores the renderer's target.
 */
export function generateOcclusion(
  renderer: THREE.WebGLRenderer,
  prepass: PrepassBuffers,
  buffers: OcclusionBuffers,
  inputs: OcclusionInputs
): void {
  const passes = passesOf(renderer);
  drawLinearDepth(renderer, passes, prepass, buffers, inputs.projection);
  drawDepthMips(renderer, passes, buffers);
  drawGather(renderer, passes, prepass, buffers, inputs);
  drawBlur(renderer, passes, buffers, inputs);
  drawInterleave(renderer, passes, buffers, inputs);
}

function drawLinearDepth(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  prepass: PrepassBuffers,
  buffers: OcclusionBuffers,
  projection: THREE.Matrix4
): void {
  const { mode, isHalfSize, baseLevel } = buffers.downsample;
  const pass =
    passes.downsample[mode === 'halfBuffers' ? 'halfBuffers' : 'plain'][isHalfSize ? 'halfSize' : 'fullSize'];
  const { z_near, z_far, isOrthogonal } = ssaoDepthLinearize(projection.elements);
  const values = { source_depth: prepass.frameDepth, z_near, z_far, orthogonal: isOrthogonal };
  drawPass(renderer, pass, values, buffers.depthLevel(baseLevel));
}

/** Mips 1 to 3, or 4 for `fullMips`, above the base (`ss_effects_downsample.glsl:94-180`). */
function drawDepthMips(renderer: THREE.WebGLRenderer, passes: Passes, buffers: OcclusionBuffers): void {
  const { mode, baseLevel, mipLevels } = buffers.downsample;
  for (let mip = 1; mip <= mipLevels; mip++) {
    const level = baseLevel + mip;
    const sources = slicesOf(buffers.depthLevel(level - 1).textures);
    const keepsCorner = mode === 'fullMips' && mip === 4;
    drawPass(renderer, passes.mip, { ...sources, keepsCorner }, buffers.depthLevel(level));
  }
}

/** Sets the gather's constants for slice `slice` (`ss_effects.cpp:1075-1079`) on `values`. */
function setSliceValues(values: Record<string, unknown>, buffers: OcclusionBuffers, slice: number): void {
  const { width, height } = buffers.shape;
  const offset = [slice % 2, Math.trunc(slice / 2)];
  values.pass = slice;
  values.pass_coord_offset = offset;
  values.pass_uv_offset = [offset[0]! / width, offset[1]! / height];
  Object.assign(values, buffers.gatherDepths[slice]);
}

function drawGather(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  prepass: PrepassBuffers,
  buffers: OcclusionBuffers,
  { projection, ssao }: OcclusionInputs
): void {
  const { width, height, project } = buffers.shape;
  const values: Record<string, unknown> = {
    ...ssaoGatherParameters(ssao, project, { width, height }, projection.elements),
    source_normal: prepass.frameNormalRoughness,
    rotation_matrices: SSAO_ROTATION_MATRICES,
  };
  const { adaptive } = buffers;
  const firstTargets = adaptive ? buffers.pong : buffers.deinterleaved;
  for (const slice of buffers.slices) {
    setSliceValues(values, buffers, slice);
    drawPass(renderer, adaptive ? passes.gatherBase : passes.gather, values, firstTargets[slice]!);
  }
  if (!adaptive) return;
  drawImportance(renderer, passes, buffers, adaptive, ssao);
  values.source_importance = adaptive.importance.texture;
  values.load_counter = adaptive.loadCounter.texture;
  for (const slice of buffers.slices) {
    setSliceValues(values, buffers, slice);
    values.source_ssao = buffers.pong[slice]!.texture;
    drawPass(renderer, passes.gatherAdaptive, values, buffers.deinterleaved[slice]!);
  }
}

/** One over the width and the height of a slice, as Godot's `half_screen_pixel_size`. */
function slicePixelSize(buffers: OcclusionBuffers): number[] {
  return [1 / buffers.sliceSize.width, 1 / buffers.sliceSize.height];
}

/** Ultra's importance map and its load counter (`ss_effects.cpp:1226-1280`). */
function drawImportance(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  buffers: OcclusionBuffers,
  { importance, importancePong, loadCounter }: AdaptiveBuffers,
  ssao: ScreenSpaceAmbientOcclusion
): void {
  const shared = {
    half_screen_pixel_size: slicePixelSize(buffers),
    intensity: ssao.intensity,
    power: ssao.power,
  };
  drawPass(
    renderer,
    passes.importance.generate,
    { ...shared, ...slicesOf(texturesOf(buffers.pong)) },
    importance
  );
  drawPass(
    renderer,
    passes.importance.processA,
    { ...shared, source_importance: importance.texture },
    importancePong
  );
  drawPass(
    renderer,
    passes.importance.processB,
    { ...shared, source_importance: importancePong.texture },
    importance
  );
  const { width, height } = buffers.importanceSize;
  const groups = [width, height].map((side) => Math.ceil(side / WORK_GROUP_SIZE) * WORK_GROUP_SIZE);
  const counter = {
    source_importance: importancePong.texture,
    half_screen_pixel_size: shared.half_screen_pixel_size,
    groups,
  };
  drawPass(renderer, passes.loadCounter, counter, loadCounter);
}

/** The edge-aware blur, back and forth between the slices and the pong (`ss_effects.cpp:1316-1381`). */
function drawBlur(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  buffers: OcclusionBuffers,
  { ssao }: OcclusionInputs
): void {
  const { project } = buffers.shape;
  const shared = {
    edge_sharpness: 1 - ssao.sharpness,
    half_screen_pixel_size: slicePixelSize(buffers),
  };
  ssaoBlurModes(project.quality, project.blurPasses).forEach((mode, pass) => {
    const [source, target] =
      pass % 2 === 0 ? [buffers.deinterleaved, buffers.pong] : [buffers.pong, buffers.deinterleaved];
    for (const slice of buffers.slices) {
      drawPass(
        renderer,
        passes.blur[mode],
        { ...shared, source_ssao: source[slice]!.texture },
        target[slice]!
      );
    }
  });
}

function drawInterleave(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  buffers: OcclusionBuffers,
  { ssao }: OcclusionInputs
): void {
  const { width, height, project } = buffers.shape;
  const source = ssaoReadsBlurredFromPong(project.quality, project.blurPasses)
    ? buffers.pong
    : buffers.deinterleaved;
  const values = {
    ...slicesOf(texturesOf(source)),
    inv_sharpness: 1 - ssao.sharpness,
    size_modifier: project.isHalfSize ? 4 : 2,
    pixel_size: [1 / width, 1 / height],
  };
  drawPass(renderer, passes.interleave[ssaoInterleaveMode(project.quality)], values, buffers.occlusion);
}
