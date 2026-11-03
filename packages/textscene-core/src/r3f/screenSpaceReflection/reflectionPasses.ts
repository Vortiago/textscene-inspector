/**
 * The passes of one screen-space reflection, in Godot's order (`ss_effects.cpp:1473-1700`): the
 * base of the depth pyramid and the normal and roughness the trace reads, the rest of the pyramid,
 * the trace, the roughness filter, and the reflection at the world buffer's size. The copy of the
 * finished frame for the next trace runs once the frame is drawn.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { drawFullScreen, namedUniformPass, releaseTextures, setUniforms } from '../fullScreenPass.js';
import { copyTexels } from '../texelCopy.js';
import type { ScreenSpaceReflection } from '../../resources/environment/types.js';
import type { ReflectionBuffers } from './reflectionBuffers.js';
import {
  DEPTH_COPY_FRAGMENT,
  DOWNSAMPLE_FRAGMENT,
  FILTER_FRAGMENT,
  FULL_SIZE_FRAGMENT,
  HIZ_FRAGMENT,
  LAST_FRAME_FRAGMENT,
  RESOLVE_FRAGMENT,
  sampleResolveFragment,
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

/** A pass whose outputs are its own, one per attachment of a multiple-target draw. */
function multipleTargetPass(pass: THREE.ShaderMaterial): THREE.ShaderMaterial {
  pass.glslVersion = THREE.GLSL3;
  return pass;
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
  filter: namedUniformPass('SsrFilter', FILTER_FRAGMENT, ['chain', 'mip_level']),
  resolve: namedUniformPass('SsrResolve', RESOLVE_FRAGMENT, [
    'source_depth',
    'source_normal_roughness',
    'source_depth_half',
    'source_normal_roughness_half',
    'source_color',
    'source_mip_level',
  ]),
  fullSize: namedUniformPass('SsrFullSize', FULL_SIZE_FRAGMENT, ['source_color', 'source_mip_level']),
  lastFrame: namedUniformPass('SsrLastFrame', LAST_FRAME_FRAGMENT, ['frame', 'blockSize']),
}));

type Passes = ReturnType<typeof passesOf>;

/** Each renderer's sample resolve, one per sample count, as the count shapes its program. */
const sampleResolvesOf = perObject(
  (_renderer: THREE.WebGLRenderer) => new Map<number, THREE.ShaderMaterial>()
);

function sampleResolveOf(renderer: THREE.WebGLRenderer, samples: number): THREE.ShaderMaterial {
  const resolves = sampleResolvesOf(renderer);
  let resolve = resolves.get(samples);
  if (!resolve) {
    const names = Array.from({ length: samples }, (_, i) => [`depth${i}`, `normalRoughness${i}`]).flat();
    resolve = multipleTargetPass(namedUniformPass('SsrSampleResolve', sampleResolveFragment(samples), names));
    resolves.set(samples, resolve);
  }
  return resolve;
}

/** Draws `pass` into `target`, after which the pass holds none of the textures it read. */
function draw(
  renderer: THREE.WebGLRenderer,
  pass: THREE.ShaderMaterial,
  values: Record<string, unknown>,
  target: THREE.WebGLRenderTarget
): void {
  setUniforms(pass, values);
  drawFullScreen(renderer, pass, target);
  releaseTextures(pass);
}

/**
 * Draws the reflection of the frame whose prepass `buffers` holds into `buffers.reflection`, from
 * the last frame in `buffers.lastFrame`. The caller restores the renderer's target.
 */
export function traceReflection(
  renderer: THREE.WebGLRenderer,
  buffers: ReflectionBuffers,
  inputs: TraceInputs
): void {
  const passes = passesOf(renderer);
  resolveSamples(renderer, buffers);
  drawPyramidBase(renderer, passes, buffers);
  drawPyramid(renderer, passes, buffers);
  drawTrace(renderer, passes, buffers, inputs);
  drawRoughnessChain(renderer, passes, buffers);
  drawReflection(renderer, passes, buffers);
}

/** One frame of the samples' prepasses, where the world buffer has more than one sample. */
function resolveSamples(renderer: THREE.WebGLRenderer, buffers: ReflectionBuffers): void {
  if (!buffers.resolved) return;
  const values = Object.fromEntries(
    buffers.samplePrepasses.flatMap((prepass, i) => [
      [`depth${i}`, prepass.depthTexture],
      [`normalRoughness${i}`, prepass.texture],
    ])
  );
  draw(renderer, sampleResolveOf(renderer, buffers.samplePrepasses.length), values, buffers.resolved);
}

/**
 * The depth and the normal and roughness the trace reads, at its size, in Godot's rows. At half
 * size the R32F depth and the RGBA8 normal draw apart: the depth is the pyramid's own mip 0.
 */
function drawPyramidBase(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const { hiz, normalRoughness, frameDepth: depth, frameNormalRoughness } = buffers;
  if (!buffers.shape.isHalfSize) {
    draw(renderer, passes.depthCopy, { depth }, hiz);
    copyTexels(renderer, frameNormalRoughness, normalRoughness, buffers.rowsReversed);
    return;
  }
  const source = { depth, normalRoughness: frameNormalRoughness };
  draw(renderer, passes.downsample, { ...source, writesNormal: false }, hiz);
  draw(renderer, passes.downsample, { ...source, writesNormal: true }, normalRoughness);
}

/** Each mip of the depth pyramid from the one before (`ss_effects.cpp:1563-1610`). */
function drawPyramid(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  for (let level = 1; level < buffers.mipCount; level++) {
    const target = buffers.hizLevel(level);
    draw(renderer, passes.hiz, { pyramid: buffers.hiz.texture, sourceLevel: level - 1 }, target);
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
  draw(renderer, passes.trace, values, buffers.trace);
}

/** The traced colour into the chain's base, then each mip blurred from the one before (`:1666-1690`). */
function drawRoughnessChain(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const { chain } = buffers;
  renderer.copyTextureToTexture(buffers.trace.textures[0]!, chain.texture, null, null, 0, 0);
  for (let level = 1; level < buffers.mipCount; level++) {
    const target = buffers.chainLevel(level);
    draw(renderer, passes.filter, { chain: chain.texture, mip_level: level }, target);
    renderer.copyTextureToTexture(target.texture, chain.texture, null, null, 0, level);
  }
}

/** The reflection as the colour pass reads it: resolved from half size, or read at its mip. */
function drawReflection(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const color = { source_color: buffers.chain.texture, source_mip_level: buffers.trace.textures[1] };
  if (!buffers.shape.isHalfSize) {
    draw(renderer, passes.fullSize, color, buffers.reflection);
    return;
  }
  const halfSize = {
    source_depth: buffers.frameDepth,
    source_normal_roughness: buffers.frameNormalRoughness,
    source_depth_half: buffers.hiz.texture,
    source_normal_roughness_half: buffers.normalRoughness.texture,
  };
  draw(renderer, passes.resolve, { ...color, ...halfSize }, buffers.reflection);
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
  draw(renderer, passesOf(renderer).lastFrame, { frame, blockSize }, buffers.lastFrame);
}
