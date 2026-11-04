/**
 * One world buffer's screen-space reflection, which lives as long as the buffer: its buffers and
 * the camera of its last frame. Each trace reads this frame's prepass and the last frame's colour,
 * and the end of each render copies the finished frame for the next trace
 * (`render_forward_clustered.cpp:2413-2417`).
 */

import * as THREE from 'three';
import type { ScreenSpaceReflection } from '../../resources/environment/types.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';
import { leaveSlot } from '../sharedTexture.js';
import type { PrepassBuffers } from '../screenSpaceEffects/prepassBuffers.js';
import { ReflectionBuffers, type ReflectionShape } from './reflectionBuffers.js';
import { copyLastFrame, traceReflection } from './reflectionPasses.js';
import { ReflectionFrames } from './reflectionFrames.js';
import { reflectionSlot } from './ssrUniforms.js';

/** What a trace reads at each render. */
export interface ReflectionSettings {
  ssr: ScreenSpaceReflection;
  /** The project's `screen_space_reflection/half_size`. */
  isHalfSize: boolean;
}

/**
 * Godot's `set_depth_correction(true)`: y flipped, so screen rows run top-down, and depth reversed
 * into 0 to 1 (`projection.cpp`, `ss_effects.cpp:1489`).
 */
const DEPTH_CORRECTION = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -0.5, 0.5, 0, 0, 0, 1);

/** Scratch for one trace. */
const projection = new THREE.Matrix4();
const inverseProjection = new THREE.Matrix4();
const reprojection = new THREE.Matrix4();

export class WorldReflection {
  private buffers: ReflectionBuffers | null = null;
  /** Godot starts both at identity, over a last frame cleared to zero (`ss_effects.cpp:392`). */
  private readonly lastProjection = new THREE.Matrix4();
  private readonly lastView = new THREE.Matrix4();
  private readonly frames = new ReflectionFrames();

  /** The reflection of the last trace, as the colour pass reads it. Null before the first. */
  get reflection(): THREE.Texture | null {
    return this.buffers?.reflection.texture ?? null;
  }

  /** Traces the reflection of the frame `prepass` holds, seen through `camera`, at `settings`. */
  trace(
    renderer: THREE.WebGLRenderer,
    prepass: PrepassBuffers,
    camera: THREE.Camera,
    { ssr, isHalfSize }: ReflectionSettings
  ): void {
    const { width, height } = prepass.shape;
    const buffers = this.buffersFor(renderer, { width, height, isHalfSize });
    projection.multiplyMatrices(DEPTH_CORRECTION, camera.projectionMatrix);
    inverseProjection.copy(projection).invert();
    const inputs = {
      projection,
      inverseProjection,
      reprojection: this.reprojectionOf(camera),
      isOrthogonal: (camera as THREE.OrthographicCamera).isOrthographicCamera === true,
      ssr,
    };
    beginStep(renderer, 'Screen-space reflection');
    traceReflection(renderer, prepass, buffers, inputs);
    endStep(renderer, 'Screen-space reflection');
  }

  /**
   * Copies the finished `frame` for the next trace, and is true when the preview should draw one
   * more frame to reflect it. The caller restores the renderer's target.
   */
  finish(renderer: THREE.WebGLRenderer, frame: THREE.Texture): boolean {
    copyLastFrame(renderer, this.buffers!, frame);
    return this.frames.traced();
  }

  /** Frees the buffers, first taking the slot off them: binding a deleted texture is an error. */
  release(renderer: THREE.WebGLRenderer): void {
    if (!this.buffers) return;
    leaveSlot(renderer, reflectionSlot, this.buffers.reflection.texture);
    this.buffers.dispose();
    this.buffers = null;
  }

  private buffersFor(renderer: THREE.WebGLRenderer, shape: ReflectionShape): ReflectionBuffers {
    if (this.buffers?.fits(shape)) return this.buffers;
    this.release(renderer);
    this.buffers = new ReflectionBuffers(renderer, shape);
    return this.buffers;
  }

  /**
   * `last_projection * last_view * camera_world * projection^-1` (`render_forward_clustered.cpp:1469-1476`),
   * after which this frame's camera becomes the last frame's.
   */
  private reprojectionOf(camera: THREE.Camera): THREE.Matrix4 {
    reprojection
      .multiplyMatrices(this.lastProjection, this.lastView)
      .multiply(camera.matrixWorld)
      .multiply(inverseProjection);
    this.lastProjection.copy(projection);
    this.lastView.copy(camera.matrixWorldInverse);
    return reprojection;
  }
}
