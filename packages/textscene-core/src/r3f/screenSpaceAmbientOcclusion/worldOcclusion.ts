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
import { FittedBuffers } from '../screenSpaceEffects/fittedBuffers.js';
import { OcclusionBuffers, type OcclusionShape } from './occlusionBuffers.js';
import { generateOcclusion } from './occlusionPasses.js';
import { occlusionSlot } from './ssaoUniforms.js';

/** What a generation reads at each render. */
export interface OcclusionSettings {
  ssao: ScreenSpaceAmbientOcclusion;
  project: SsaoProjectSettings;
}

export class WorldOcclusion {
  private readonly buffers = new FittedBuffers(
    (_renderer, shape: OcclusionShape) => new OcclusionBuffers(shape),
    (renderer, buffers) => leaveSlot(renderer, occlusionSlot, buffers.occlusion.texture)
  );

  /** The occlusion of the last generation, as the colour pass reads it. Null before the first. */
  get occlusion(): THREE.Texture | null {
    return this.buffers.current?.occlusion.texture ?? null;
  }

  /** Draws the occlusion of the frame `prepass` holds, seen through `camera`, at `settings`. */
  generate(
    renderer: THREE.WebGLRenderer,
    prepass: PrepassBuffers,
    camera: THREE.Camera,
    { ssao, project }: OcclusionSettings
  ): void {
    const { width, height } = prepass.shape;
    const buffers = this.buffers.fit(renderer, { width, height, project });
    beginStep(renderer, 'Screen-space ambient occlusion');
    generateOcclusion(renderer, prepass, buffers, { projection: camera.projectionMatrix, ssao });
    endStep(renderer, 'Screen-space ambient occlusion');
  }

  release(renderer: THREE.WebGLRenderer): void {
    this.buffers.release(renderer);
  }
}
