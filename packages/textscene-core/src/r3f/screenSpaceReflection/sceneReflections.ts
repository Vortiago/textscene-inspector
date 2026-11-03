/**
 * The screen-space reflection of each render of one scene. A sentinel that three draws first in the
 * opaque list traces it, as Godot traces between its depth prepass and its opaque pass
 * (`render_forward_clustered.cpp:2150`), and the end of the render copies the finished frame for the
 * next trace (`:2413-2417`). Each world buffer keeps its own buffers and the camera of its last frame.
 */

import * as THREE from 'three';
import type { ScreenSpaceReflection } from '../../resources/environment/types.js';
import { probeCaptureOf } from '../reflectionProbe/captureCameras.js';
import { drawOffscreen } from '../offscreen.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';
import { createFirstOpaqueSentinel, disposeFirstOpaqueSentinel } from '../firstOpaqueSentinel.js';
import { leaveSlot, showInSlot } from '../sharedTexture.js';
import { drawsTransparentBackground } from '../environment/toneMapPass.js';
import { ReflectionBuffers, type ReflectionShape } from './reflectionBuffers.js';
import { copyLastFrame, traceReflection } from './reflectionPasses.js';
import { drawSamplePrepasses } from './normalRoughnessPrepass.js';
import { showBestFitNormals } from './bestFitNormals.js';
import { ReflectionFrames } from './reflectionFrames.js';
import { reflectionSlot, SSR_STATE, ssrState } from './ssrUniforms.js';

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

/** One world buffer's reflection, which lives as long as the buffer. */
class WorldReflection {
  buffers: ReflectionBuffers | null = null;
  /** Godot starts both at identity, over a last frame cleared to zero (`ss_effects.cpp:392`). */
  readonly lastProjection = new THREE.Matrix4();
  readonly lastView = new THREE.Matrix4();
  readonly frames = new ReflectionFrames();

  buffersFor(renderer: THREE.WebGLRenderer, shape: ReflectionShape): ReflectionBuffers {
    if (this.buffers?.fits(shape)) return this.buffers;
    this.release(renderer);
    this.buffers = new ReflectionBuffers(renderer, shape);
    return this.buffers;
  }

  /** Frees the buffers, first taking the slot off them: binding a deleted texture is an error. */
  release(renderer: THREE.WebGLRenderer): void {
    if (!this.buffers) return;
    leaveSlot(renderer, reflectionSlot, this.buffers.reflection.texture);
    this.buffers.dispose();
    this.buffers = null;
  }
}

/** One render of the scene. `world` is null for a render Godot traces no reflection in. */
interface SceneRender {
  readonly camera: THREE.Camera;
  readonly target: THREE.WebGLRenderTarget | null;
  readonly world: WorldReflection | null;
  isTraced: boolean;
}

/** Scratch for one trace. */
const projection = new THREE.Matrix4();
const inverseProjection = new THREE.Matrix4();
const reprojection = new THREE.Matrix4();

export class SceneReflections {
  readonly sentinel: THREE.Mesh;
  private readonly worlds = new Map<THREE.WebGLRenderTarget, WorldReflection>();
  /** Written by `begin` and `end`, as renders of the scene nest. */
  private readonly renders: SceneRender[] = [];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly settings: () => ReflectionSettings,
    private readonly askFrame: () => void
  ) {
    this.sentinel = createFirstOpaqueSentinel('ScreenSpaceReflection', (_renderer, scene, camera) =>
      this.trace(scene, camera)
    );
  }

  /** Starts a render of the scene through `camera` into `target`, null for the canvas. */
  readonly begin = (camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void => {
    this.renders.push({ camera, target, world: this.worldOf(camera, target), isTraced: false });
    ssrState[SSR_STATE.showsReflection] = 0;
  };

  /** Ends the innermost render: keeps its frame for the next trace, and shows the outer render's reflection again. */
  readonly end = (): void => {
    const render = this.renders.pop();
    if (render?.isTraced) this.finish(render);
    const outer = this.renders.at(-1);
    if (outer?.isTraced) this.show(outer.world!.buffers!);
    else ssrState[SSR_STATE.showsReflection] = 0;
  };

  dispose(): void {
    for (const [target, world] of this.worlds) this.release(target, world);
    disposeFirstOpaqueSentinel(this.sentinel);
  }

  /**
   * A world buffer's reflection, or null where Godot traces none: a reflection probe's capture and a
   * viewport with a transparent background (`render_forward_clustered.cpp:1810-1852`). Every 3D
   * render draws into a world buffer (`toneMapPass.ts`), so the canvas is no world.
   */
  private worldOf(camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): WorldReflection | null {
    if (!target || probeCaptureOf(camera) || drawsTransparentBackground(target)) return null;
    let world = this.worlds.get(target);
    if (!world) {
      world = new WorldReflection();
      this.worlds.set(target, world);
      target.addEventListener('dispose', this.onTargetDispose);
    }
    return world;
  }

  private readonly onTargetDispose = (event: { target: THREE.WebGLRenderTarget }): void => {
    const world = this.worlds.get(event.target);
    if (world) this.release(event.target, world);
  };

  private release(target: THREE.WebGLRenderTarget, world: WorldReflection): void {
    target.removeEventListener('dispose', this.onTargetDispose);
    world.release(this.renderer);
    this.worlds.delete(target);
  }

  /**
   * Traces the innermost render's reflection once, in its opaque pass. three's transmission pass
   * draws the opaque list into a target of its own first, which no trace serves.
   */
  private trace(scene: THREE.Scene, camera: THREE.Camera): void {
    const render = this.renders.at(-1);
    if (!render?.world || render.isTraced || this.renderer.getRenderTarget() !== render.target) return;
    const target = render.target!;
    const { ssr, isHalfSize } = this.settings();
    const { width, height, samples } = target;
    const buffers = render.world.buffersFor(this.renderer, { width, height, samples, isHalfSize });
    projection.multiplyMatrices(DEPTH_CORRECTION, camera.projectionMatrix);
    inverseProjection.copy(projection).invert();
    const inputs = {
      projection,
      inverseProjection,
      reprojection: this.reprojectionOf(render.world, camera),
      isOrthogonal: (camera as THREE.OrthographicCamera).isOrthographicCamera === true,
      ssr,
    };
    beginStep(this.renderer, 'Screen-space reflection');
    drawOffscreen(this.renderer, () => {
      showBestFitNormals(this.renderer);
      drawSamplePrepasses(this.renderer, scene, camera, buffers.samplePrepasses);
      traceReflection(this.renderer, buffers, inputs);
    });
    endStep(this.renderer, 'Screen-space reflection');
    render.isTraced = true;
    this.show(buffers);
  }

  /**
   * `last_projection * last_view * camera_world * projection^-1` (`render_forward_clustered.cpp:1469-1476`),
   * after which this frame's camera becomes the last frame's.
   */
  private reprojectionOf(world: WorldReflection, camera: THREE.Camera): THREE.Matrix4 {
    reprojection
      .multiplyMatrices(world.lastProjection, world.lastView)
      .multiply(camera.matrixWorld)
      .multiply(inverseProjection);
    world.lastProjection.copy(projection);
    world.lastView.copy(camera.matrixWorldInverse);
    return reprojection;
  }

  private show(buffers: ReflectionBuffers): void {
    showInSlot(this.renderer, reflectionSlot, buffers.reflection.texture);
    ssrState[SSR_STATE.showsReflection] = 1;
  }

  /** Copies the finished frame, and asks for the frame that first reads it. */
  private finish(render: SceneRender): void {
    const buffers = render.world!.buffers!;
    drawOffscreen(this.renderer, () => copyLastFrame(this.renderer, buffers, render.target!.texture));
    if (render.world!.frames.traced()) this.askFrame();
  }
}
