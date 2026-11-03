/**
 * The passes of one screen-space reflection, in Godot's order (`ss_effects.cpp:1473-1700`): the
 * base of the depth pyramid and the normal and roughness the trace reads, the rest of the pyramid,
 * the trace, the roughness filter, and the reflection at the world buffer's size. The copy of the
 * finished frame for the next trace runs once the frame is drawn.
 */

import * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass.js';
import type { ReflectionBuffers } from './reflectionBuffers.js';
import {
  DEPTH_COPY_FRAGMENT,
  DOWNSAMPLE_FRAGMENT,
  FILTER_FRAGMENT,
  FULL_SIZE_FRAGMENT,
  HIZ_FRAGMENT,
  LAST_FRAME_FRAGMENT,
  NORMAL_ROUGHNESS_ROWS_FRAGMENT,
  RESOLVE_FRAGMENT,
  sampleResolveFragment,
  TRACE_FRAGMENT,
} from './ssrShaders.js';

/** The camera and the Environment's settings one trace reads. */
export interface TraceInputs {
  /** Godot's projection of the camera, its depth corrected (`ss_effects.cpp:1489-1494`). */
  projection: THREE.Matrix4;
  /** From this frame's screen to the last frame's (`render_forward_clustered.cpp:1469-1476`). */
  reprojection: THREE.Matrix4;
  isOrthogonal: boolean;
  maxSteps: number;
  fadeIn: number;
  fadeOut: number;
  depthTolerance: number;
}

/** A uniform for each name, its value unset until a draw writes it. */
function uniformsOf(...names: string[]): Record<string, THREE.IUniform> {
  return Object.fromEntries(names.map((name) => [name, { value: null }]));
}

function tracePass(): THREE.ShaderMaterial {
  const pass = fullScreenPass(
    'SsrTrace',
    TRACE_FRAGMENT,
    uniformsOf(
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
      'orthogonal'
    )
  );
  // Its own outputs, one per attachment of the trace's target.
  pass.glslVersion = THREE.GLSL3;
  return pass;
}

/** One set of passes per renderer, as each pass is (`fullScreenPass.ts`). */
const passesOf = perObject((_renderer: THREE.WebGLRenderer) => ({
  depthCopy: fullScreenPass('SsrDepthCopy', DEPTH_COPY_FRAGMENT, uniformsOf('depth')),
  normalRoughnessRows: fullScreenPass(
    'SsrNormalRoughnessRows',
    NORMAL_ROUGHNESS_ROWS_FRAGMENT,
    uniformsOf('normalRoughness')
  ),
  downsample: fullScreenPass(
    'SsrDownsample',
    DOWNSAMPLE_FRAGMENT,
    uniformsOf('depth', 'normalRoughness', 'writesNormal')
  ),
  hiz: fullScreenPass('SsrHiz', HIZ_FRAGMENT, uniformsOf('pyramid', 'sourceLevel')),
  trace: tracePass(),
  filter: fullScreenPass('SsrFilter', FILTER_FRAGMENT, uniformsOf('chain', 'mip_level')),
  resolve: fullScreenPass(
    'SsrResolve',
    RESOLVE_FRAGMENT,
    uniformsOf(
      'source_depth',
      'source_normal_roughness',
      'source_depth_half',
      'source_normal_roughness_half',
      'source_color',
      'source_mip_level'
    )
  ),
  fullSize: fullScreenPass('SsrFullSize', FULL_SIZE_FRAGMENT, uniformsOf('source_color', 'source_mip_level')),
  lastFrame: fullScreenPass('SsrLastFrame', LAST_FRAME_FRAGMENT, uniformsOf('frame', 'blockSize')),
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
    resolve = fullScreenPass(
      'SsrSampleResolve',
      sampleResolveFragment(samples),
      uniformsOf(...names, 'writesNormal')
    );
    resolves.set(samples, resolve);
  }
  return resolve;
}

/** Scratch for one trace, read when its draw uploads it. */
const inverseProjection = new THREE.Matrix4();

function set(pass: THREE.ShaderMaterial, values: Record<string, unknown>): THREE.ShaderMaterial {
  for (const [name, value] of Object.entries(values)) pass.uniforms[name]!.value = value;
  return pass;
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
  const resolve = sampleResolveOf(renderer, buffers.samplePrepasses.length);
  buffers.samplePrepasses.forEach((prepass, i) => {
    resolve.uniforms[`depth${i}`]!.value = prepass.depthTexture;
    resolve.uniforms[`normalRoughness${i}`]!.value = prepass.texture;
  });
  drawFullScreen(renderer, set(resolve, { writesNormal: false }), buffers.resolved.depth);
  drawFullScreen(renderer, set(resolve, { writesNormal: true }), buffers.resolved.normalRoughness);
}

/** The depth and the normal and roughness the trace reads, at its size, in Godot's rows. */
function drawPyramidBase(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const { hiz, normalRoughness, frameDepth: depth, frameNormalRoughness } = buffers;
  if (!buffers.isHalfSize) {
    drawFullScreen(renderer, set(passes.depthCopy, { depth }), hiz);
    drawFullScreen(
      renderer,
      set(passes.normalRoughnessRows, { normalRoughness: frameNormalRoughness }),
      normalRoughness
    );
    return;
  }
  const downsample = set(passes.downsample, { depth, normalRoughness: frameNormalRoughness });
  drawFullScreen(renderer, set(downsample, { writesNormal: false }), hiz);
  drawFullScreen(renderer, set(downsample, { writesNormal: true }), normalRoughness);
}

/** Each mip of the depth pyramid from the one before (`ss_effects.cpp:1563-1610`). */
function drawPyramid(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  for (let level = 1; level < buffers.mipCount; level++) {
    const target = buffers.hizLevel(level);
    drawFullScreen(
      renderer,
      set(passes.hiz, { pyramid: buffers.hiz.texture, sourceLevel: level - 1 }),
      target
    );
    renderer.copyTextureToTexture(target.texture, buffers.hiz.texture, null, null, 0, level);
  }
}

function drawTrace(
  renderer: THREE.WebGLRenderer,
  passes: Passes,
  buffers: ReflectionBuffers,
  inputs: TraceInputs
): void {
  const trace = set(passes.trace, {
    source_last_frame: buffers.lastFrame.texture,
    source_hiz: buffers.hiz.texture,
    source_normal_roughness: buffers.normalRoughness.texture,
    projection: inputs.projection,
    inv_projection: inverseProjection.copy(inputs.projection).invert(),
    reprojection: inputs.reprojection,
    mipmaps: buffers.mipCount,
    num_steps: inputs.maxSteps,
    distance_fade: inputs.fadeOut,
    curve_fade_in: inputs.fadeIn,
    depth_tolerance: inputs.depthTolerance,
    orthogonal: inputs.isOrthogonal,
  });
  drawFullScreen(renderer, trace, buffers.trace);
}

/** The traced colour into the chain's base, then each mip blurred from the one before (`:1666-1690`). */
function drawRoughnessChain(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const { chain } = buffers;
  renderer.copyTextureToTexture(buffers.trace.textures[0]!, chain.texture, null, null, 0, 0);
  for (let level = 1; level < buffers.mipCount; level++) {
    const target = buffers.chainLevel(level);
    drawFullScreen(renderer, set(passes.filter, { chain: chain.texture, mip_level: level }), target);
    renderer.copyTextureToTexture(target.texture, chain.texture, null, null, 0, level);
  }
}

/** The reflection as the colour pass reads it: resolved from half size, or read at its mip. */
function drawReflection(renderer: THREE.WebGLRenderer, passes: Passes, buffers: ReflectionBuffers): void {
  const color = { source_color: buffers.chain.texture, source_mip_level: buffers.trace.textures[1] };
  if (!buffers.isHalfSize) {
    drawFullScreen(renderer, set(passes.fullSize, color), buffers.reflection);
    return;
  }
  const resolve = set(passes.resolve, {
    ...color,
    source_depth: buffers.frameDepth,
    source_normal_roughness: buffers.frameNormalRoughness,
    source_depth_half: buffers.hiz.texture,
    source_normal_roughness_half: buffers.normalRoughness.texture,
  });
  drawFullScreen(renderer, resolve, buffers.reflection);
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
  const pass = set(passesOf(renderer).lastFrame, { frame, blockSize: buffers.isHalfSize ? 2 : 1 });
  drawFullScreen(renderer, pass, buffers.lastFrame);
}
