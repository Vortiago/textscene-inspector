/**
 * The screen-space effects of each render of one scene: its ambient occlusion and its reflection,
 * from one normal-roughness prepass. A sentinel that three draws first in the opaque list runs
 * them, as Godot runs them between its depth prepass and its opaque pass
 * (`render_forward_clustered.cpp:2150`, `:1593-1607`). One drawn last hides them from the alpha
 * pass, which Godot sets up with no screen-space effects (`:2381`, `:754-769`). Each world buffer
 * keeps its own buffers.
 */

import * as THREE from 'three';
import { probeCaptureOf } from '../reflectionProbe/captureCameras.js';
import { drawOffscreen } from '../offscreen.js';
import {
  createFirstOpaqueSentinel,
  createLastOpaqueSentinel,
  type OpaqueSentinel,
} from '../opaqueSentinel.js';
import { drawsTransparentBackground } from '../environment/toneMapPass.js';
import { WorldReflection, type ReflectionSettings } from '../screenSpaceReflection/worldReflection.js';
import { hideReflection, showReflection } from '../screenSpaceReflection/ssrUniforms.js';
import { WorldOcclusion, type OcclusionSettings } from '../screenSpaceAmbientOcclusion/worldOcclusion.js';
import { hideOcclusion, showOcclusion } from '../screenSpaceAmbientOcclusion/ssaoUniforms.js';
import { FittedBuffers } from './fittedBuffers.js';
import { PrepassBuffers, type PrepassShape } from './prepassBuffers.js';
import { drawNormalRoughnessPrepass } from './normalRoughnessPrepass.js';

/** What the effects read at each render. Each effect is null while its Environment turns it off. */
export interface ScreenSpaceSettings {
  reflection: ReflectionSettings | null;
  occlusion: OcclusionSettings | null;
  /** The project's `rendering/driver/depth_prepass/enable`, without which no occlusion is drawn. */
  drawsDepthPrepass: boolean;
}

/** One world buffer's effects, which live as long as the buffer. */
class WorldEffects {
  readonly prepass = new FittedBuffers((_renderer, shape: PrepassShape) => new PrepassBuffers(shape));
  readonly reflection = new WorldReflection();
  readonly occlusion = new WorldOcclusion();

  release(renderer: THREE.WebGLRenderer): void {
    this.reflection.release(renderer);
    this.occlusion.release(renderer);
    this.prepass.release(renderer);
  }

  /**
   * Frees the buffers of each effect `render` draws none of. The layer stays on while either
   * effect is on, so an effect its Environment turns off would otherwise keep its buffers.
   */
  releaseUnused(renderer: THREE.WebGLRenderer, { reflection, drawsOcclusion }: SceneRender): void {
    if (!reflection) this.reflection.release(renderer);
    if (!drawsOcclusion) this.occlusion.release(renderer);
    if (!reflection && !drawsOcclusion) this.prepass.release(renderer);
  }
}

/** One render of the scene. `world` is null for a render Godot runs no screen-space effect in. */
interface SceneRender {
  readonly target: THREE.WebGLRenderTarget | null;
  readonly world: WorldEffects | null;
  /** The reflection the render traces, or null for none: Godot traces none with a transparent background. */
  readonly reflection: ReflectionSettings | null;
  /** The occlusion the render folds in, or null for none. */
  readonly occlusion: OcclusionSettings | null;
  /** Whether the render draws its occlusion, or folds Godot's black default in (`render_forward_clustered.cpp:2086`). */
  readonly drawsOcclusion: boolean;
  hasRun: boolean;
  /** Whether three is past the render's latest opaque list, after which its surfaces show no effect. */
  isPastOpaque: boolean;
}

export class SceneScreenSpaceEffects {
  readonly firstSentinel: OpaqueSentinel;
  readonly lastSentinel: OpaqueSentinel;
  private readonly worlds = new Map<THREE.WebGLRenderTarget, WorldEffects>();
  /** Written by `begin` and `end`, as renders of the scene nest. */
  private readonly renders: SceneRender[] = [];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly settings: () => ScreenSpaceSettings,
    private readonly askFrame: () => void
  ) {
    this.firstSentinel = createFirstOpaqueSentinel('ScreenSpaceEffects', (_renderer, scene, camera) =>
      this.beginOpaque(scene, camera)
    );
    this.lastSentinel = createLastOpaqueSentinel('ScreenSpaceEffectsEnd', () => this.endOpaque());
  }

  /** Starts a render of the scene through `camera` into `target`, null for the canvas. */
  readonly begin = (camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void => {
    const world = this.worldOf(camera, target);
    const { reflection, occlusion, drawsDepthPrepass } = this.settings();
    const foldedOcclusion = world ? occlusion : null;
    this.renders.push({
      target,
      world,
      reflection: world && !drawsTransparentBackground(target!) ? reflection : null,
      occlusion: foldedOcclusion,
      drawsOcclusion: !!foldedOcclusion && drawsDepthPrepass,
      hasRun: false,
      isPastOpaque: false,
    });
    hideEffects();
  };

  /**
   * Ends the innermost render: keeps its frame for the next trace, and shows the outer render's
   * effects again while the outer render draws its opaque list.
   */
  readonly end = (): void => {
    const render = this.renders.pop();
    if (render?.hasRun && render.reflection) this.finish(render);
    const outer = this.renders.at(-1);
    if (outer?.hasRun && !outer.isPastOpaque) this.show(outer);
    else hideEffects();
  };

  dispose(): void {
    for (const [target, world] of this.worlds) this.release(target, world);
    this.firstSentinel.dispose();
    this.lastSentinel.dispose();
  }

  /**
   * A world buffer's effects, or null where Godot runs none: a reflection probe's capture
   * (`render_forward_clustered.cpp:2086`, `:750`). Every 3D render draws into a world buffer
   * (`toneMapPass.ts`), so the canvas is no world.
   */
  private worldOf(camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): WorldEffects | null {
    if (!target || probeCaptureOf(camera)) return null;
    let world = this.worlds.get(target);
    if (!world) {
      world = new WorldEffects();
      this.worlds.set(target, world);
      target.addEventListener('dispose', this.onTargetDispose);
    }
    return world;
  }

  private readonly onTargetDispose = (event: { target: THREE.WebGLRenderTarget }): void => {
    const world = this.worlds.get(event.target);
    if (world) this.release(event.target, world);
  };

  private release(target: THREE.WebGLRenderTarget, world: WorldEffects): void {
    target.removeEventListener('dispose', this.onTargetDispose);
    world.release(this.renderer);
    this.worlds.delete(target);
  }

  /**
   * Shows the innermost render's effects from the start of each of its opaque lists, run at the
   * first. three's transmission pass draws one before the colour pass, and the frame it refracts
   * shows them, as the screen copy after Godot's opaque pass does (`:2337`).
   */
  private beginOpaque(scene: THREE.Scene, camera: THREE.Camera): void {
    const render = this.renders.at(-1);
    if (!render?.world) return;
    if (!render.hasRun) this.run(render, render.world, scene, camera);
    if (!render.reflection && !render.occlusion) return;
    render.isPastOpaque = false;
    this.show(render);
  }

  /**
   * Frees the buffers of each effect `render` draws none of, then draws its prepass where an effect
   * reads it, and its occlusion and its reflection, in Godot's order.
   */
  private run(render: SceneRender, world: WorldEffects, scene: THREE.Scene, camera: THREE.Camera): void {
    render.hasRun = true;
    world.releaseUnused(this.renderer, render);
    const { reflection, occlusion, drawsOcclusion } = render;
    if (!drawsOcclusion && !reflection) return;
    const { width, height, samples } = render.target!;
    const prepass = world.prepass.fit(this.renderer, { width, height, samples });
    drawOffscreen(this.renderer, () => {
      drawNormalRoughnessPrepass(this.renderer, scene, camera, prepass);
      if (drawsOcclusion) world.occlusion.generate(this.renderer, prepass, camera, occlusion!);
      if (reflection) world.reflection.trace(this.renderer, prepass, camera, reflection);
    });
  }

  /** Ends an opaque list of the innermost render: the transmissive and transparent lists show none. */
  private endOpaque(): void {
    const render = this.renders.at(-1);
    if (!render) return;
    render.isPastOpaque = true;
    hideEffects();
  }

  private show(render: SceneRender): void {
    const { world, reflection, occlusion, drawsOcclusion } = render;
    if (reflection) showReflection(this.renderer, world!.reflection.reflection!);
    if (occlusion)
      showOcclusion(this.renderer, drawsOcclusion ? world!.occlusion.occlusion : null, occlusion.ssao);
  }

  /** Copies the finished frame, and asks for the frame that first reads it. */
  private finish(render: SceneRender): void {
    let asksFrame = false;
    drawOffscreen(this.renderer, () => {
      asksFrame = render.world!.reflection.finish(this.renderer, render.target!.texture);
    });
    if (asksFrame) this.askFrame();
  }
}

function hideEffects(): void {
  hideReflection();
  hideOcclusion();
}
