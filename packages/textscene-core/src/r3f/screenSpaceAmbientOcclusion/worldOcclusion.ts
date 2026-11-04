/**
 * One world buffer's screen-space ambient occlusion, which lives as long as the buffer: its buffers,
 * shaped by the frame and the project's settings (`ss_effects.cpp:1098-1128`).
 */

import * as THREE from 'three';
import type { ScreenSpaceAmbientOcclusion } from '../../resources/environment/types.js';
import type { SsaoProjectSettings } from '../../godot/rendering/environment/screenSpaceAmbientOcclusion.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';
import { leaveSlot } from '../sharedTexture.js';
import type { PrepassBuffers } from '../screenSpaceEffects/prepassBuffers.js';
import { OcclusionBuffers, type OcclusionShape } from './occlusionBuffers.js';
import { generateOcclusion } from './occlusionPasses.js';
import { occlusionSlot } from './ssaoUniforms.js';

/** What a generation reads at each render. */
export interface OcclusionSettings {
  ssao: ScreenSpaceAmbientOcclusion;
  project: SsaoProjectSettings;
}

export class WorldOcclusion {
  private buffers: OcclusionBuffers | null = null;

  /** The occlusion of the last generation, as the colour pass reads it. Null before the first. */
  get occlusion(): THREE.Texture | null {
    return this.buffers?.occlusion.texture ?? null;
  }

  /** Draws the occlusion of the frame `prepass` holds, seen through `camera`, at `settings`. */
  generate(
    renderer: THREE.WebGLRenderer,
    prepass: PrepassBuffers,
    camera: THREE.Camera,
    { ssao, project }: OcclusionSettings
  ): void {
    const { width, height } = prepass.shape;
    const buffers = this.buffersFor(renderer, { width, height, project });
    beginStep(renderer, 'Screen-space ambient occlusion');
    generateOcclusion(renderer, prepass, buffers, { projection: camera.projectionMatrix, ssao, project });
    endStep(renderer, 'Screen-space ambient occlusion');
  }

  /** Frees the buffers, first taking the slot off them: binding a deleted texture is an error. */
  release(renderer: THREE.WebGLRenderer): void {
    if (!this.buffers) return;
    leaveSlot(renderer, occlusionSlot, this.buffers.occlusion.texture);
    this.buffers.dispose();
    this.buffers = null;
  }

  private buffersFor(renderer: THREE.WebGLRenderer, shape: OcclusionShape): OcclusionBuffers {
    if (this.buffers?.fits(shape)) return this.buffers;
    this.release(renderer);
    this.buffers = new OcclusionBuffers(shape);
    return this.buffers;
  }
}
