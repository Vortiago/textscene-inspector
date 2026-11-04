/**
 * The passes of one screen-space reflection, in Godot's order (`ss_effects.cpp:1473-1700`): the
 * base of the depth pyramid and the normal and roughness the trace reads, the rest of the pyramid,
 * the trace, the roughness filter, and the reflection at the world buffer's size. The copy of the
 * finished frame for the next trace runs once the frame is drawn.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { drawPass, multipleTargetPass, namedUniformPass } from '../fullScreenPass.js';
import { copyTexels } from '../texelCopy.js';
import type { ScreenSpaceReflection } from '../../resources/environment/types.js';
import type { ReflectionBuffers } from './reflectionBuffers.js';
import type { PrepassBuffers } from '../screenSpaceEffects/prepassBuffers.js';
import {
  DEPTH_COPY_FRAGMENT,
  DOWNSAMPLE_FRAGMENT,
  FILTER_ACROSS_FRAGMENT,
  FILTER_DOWN_FRAGMENT,
  FULL_SIZE_FRAGMENT,
  HIZ_FRAGMENT,
  LAST_FRAME_FRAGMENT,
  RESOLVE_FRAGMENT,
  TRACE_FRAGMENT,
} from './ssrShaders.js';

/** The camera and the Environment's settings one trace reads. */
export interface TraceInputs {
  /** Godot's projection of the camera, its depth corrected (`ss_effects.cpp:1489-1494`). */
  projection: THREE.Matrix4;
  inverseProjection: THREE.Matrix4;
  /** From this frame's screen to the last frame's (`render_forward_clustered.cpp:1469-1476`). */
  reprojection: THREE.Matrix4;
  isOrthogonal: boolean;
  ssr: ScreenSpaceReflection;
}

function resolvePass(name: string): THREE.ShaderMaterial {
  return namedUniformPass(name, RESOLVE_FRAGMENT, [
    'source_depth',
    'source_normal_roughness',
    'source_depth_half',
    'source_normal_roughness_half',
    'source_color',
    'source_mip_level',
  ]);
}

/** One set of passes per renderer, as each pass is (`fullScreenPass.ts`). */
const passesOf = perObject((_renderer: THREE.WebGLRenderer) => ({
  depthCopy: namedUniformPass('SsrDepthCopy', DEPTH_COPY_FRAGMENT, ['depth']),
  downsample: namedUniformPass('SsrDownsample', DOWNSAMPLE_FRAGMENT, [
    'depth',
    'normalRoughness',
    'writesNormal',
  ]),
  hiz: namedUniformPass('SsrHiz', HIZ_FRAGMENT, ['pyramid', 'sourceLevel']),
  trace: multipleTargetPass(
    namedUniformPass('SsrTrace', TRACE_FRAGMENT, [
      'source_last_frame',
      'source_hiz',
      'source_normal_roughness',
      'projection',
      'inv_projection',
      'reprojection',
      'mipmaps',
      'num_steps',
      'distance_fade',
      'curve_fade_in',
      'depth_tolerance',
      'orthogonal',
    ])
  ),
  filterAcross: namedUniformPass('SsrFilterAcross', FILTER_ACROSS_FRAGMENT, ['chain', 'mip_level']),
  filterDown: namedUniformPass('SsrFilterDown', FILTER_DOWN_FRAGMENT, ['across', 'mip_level']),
  resolve: resolvePass('SsrResolve'),
  resolveOneSample: Object.assign(resolvePass('SsrResolveOneSample'), { defines: { SKIPS_UNREFLECTED: '' } }),
  fullSize: namedUniformPass('SsrFullSize', FULL_SIZE_FRAGMENT, ['source_color', 'source_mip_level']),
  lastFrame: namedUniformPass('SsrLastFrame', LAST_FRAME_FRAGMENT, ['frame', 'blockSize']),
}));

type Passes = ReturnType<typeof passesOf>;

/**
 * Draws the reflection of the frame whose prepass `prepass` holds into `buffers.reflection`, from
 * the last frame in `buffers.lastFrame`. The caller restores the renderer's target.
 */
export function traceReflection(
  renderer: THREE.WebGLRenderer,
  prepass: PrepassBuffers,
  buffers: ReflectionBuffers,
  inputs: TraceInputs
): void {
  const passes = passesOf(renderer);
  drawPyramidBase(renderer, passes, prepass, buffers);
  drawPyramid(renderer, passes, buffers);
  drawTrace(renderer, passes, buffers, inputs);
  drawRoughnessChain(renderer, passes, buffers);
  drawReflection(renderer, passes, prepass, buffers);
}

/**
 * The depth and the normal and roughness the trace reads, at its size, in Godot's rows. At half
 * size the R32F depth and the RGBA8 normal draw apart: the depth is the pyramid's own mip 0.
 */
function drawPyramidBase(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  prepass: PrepassBuffers,
  buffers: ReflectionBuffers
): void {
  const { frameDepth: depth, frameNormalRoughness } = prepass;
  const { hiz, normalRoughness } = buffers;
  if (!buffers.shape.isHalfSize) {
    drawPass(renderer, passes.depthCopy, { depth }, hiz);
    copyTexels(renderer, frameNormalRoughness, normalRoughness, buffers.rowsReversed);
    return;
  }
  const source = { depth, normalRoughness: frameNormalRoughness };
  drawPass(renderer, passes.downsample, { ...source, writesNormal: false }, hiz);
  drawPass(renderer, passes.downsample, { ...source, writesNormal: true }, normalRoughness);
}

/** Each mip of the depth pyramid from the one before (`ss_effects.cpp:1563-1610`). */
function drawPyramid(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  for (let level = 1; level < buffers.mipCount; level++) {
    const target = buffers.hizLevel(level);
    drawPass(renderer, passes.hiz, { pyramid: buffers.hiz.texture, sourceLevel: level - 1 }, target);
    renderer.copyTextureToTexture(target.texture, buffers.hiz.texture, null, null, 0, level);
  }
}

function drawTrace(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  buffers: ReflectionBuffers,
  inputs: TraceInputs
): void {
  const { ssr } = inputs;
  const values = {
    source_last_frame: buffers.lastFrame.texture,
    source_hiz: buffers.hiz.texture,
    source_normal_roughness: buffers.normalRoughness.texture,
    projection: inputs.projection,
    inv_projection: inputs.inverseProjection,
    reprojection: inputs.reprojection,
    mipmaps: buffers.mipCount,
    num_steps: ssr.maxSteps,
    distance_fade: ssr.fadeOut,
    curve_fade_in: ssr.fadeIn,
    depth_tolerance: ssr.depthTolerance,
    orthogonal: inputs.isOrthogonal,
  };
  drawPass(renderer, passes.trace, values, buffers.trace);
}

/** The traced colour into the chain's base, then each mip blurred from the one before (`:1666-1690`). */
function drawRoughnessChain(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const { chain } = buffers;
  renderer.copyTextureToTexture(buffers.trace.textures[0]!, chain.texture, null, null, 0, 0);
  for (let level = 1; level < buffers.mipCount; level++) {
    const across = buffers.chainAcrossLevel(level);
    const target = buffers.chainLevel(level);
    drawPass(renderer, passes.filterAcross, { chain: chain.texture, mip_level: level }, across);
    drawPass(renderer, passes.filterDown, { across: across.texture, mip_level: level }, target);
    renderer.copyTextureToTexture(target.texture, chain.texture, null, null, 0, level);
  }
}

/** The reflection as the colour pass reads it: resolved from half size, or read at its mip. */
function drawReflection(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  prepass: PrepassBuffers,
  buffers: ReflectionBuffers
): void {
  const color = { source_color: buffers.chain.texture, source_mip_level: buffers.trace.textures[1] };
  if (!buffers.shape.isHalfSize) {
    drawPass(renderer, passes.fullSize, color, buffers.reflection);
    return;
  }
  const halfSize = {
    source_depth: prepass.frameDepth,
    source_normal_roughness: prepass.frameNormalRoughness,
    source_depth_half: buffers.hiz.texture,
    source_normal_roughness_half: buffers.normalRoughness.texture,
  };
  const resolve = prepass.resolved ? passes.resolve : passes.resolveOneSample;
  drawPass(renderer, resolve, { ...color, ...halfSize }, buffers.reflection);
}

/**
 * Copies the finished frame in `frame` into `buffers.lastFrame` for the next trace, whole or as
 * each 2 x 2 block's mean at half size.
 */
export function copyLastFrame(
  renderer: THREE.WebGLRenderer,
  buffers: ReflectionBuffers,
  frame: THREE.Texture
): void {
  const blockSize = buffers.shape.isHalfSize ? 2 : 1;
  drawPass(renderer, passesOf(renderer).lastFrame, { frame, blockSize }, buffers.lastFrame);
}
