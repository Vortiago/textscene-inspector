/** The render state of a GPUParticles3D: its GeometryInstance3D state, its box, its emitter and its draw passes. */

import type { Aabb } from '../../../../godot/math/aabb';
import type { GpuEmitter } from '../../../shared/gpuparticles/emitter';
import type { GeometryInstance3DProperties } from '../../geometryinstance3d/types';

/** `MAX_DRAW_PASSES` (`gpu_particles_3d.h`). */
export const MAX_DRAW_PASSES = 4;

export interface GPUParticles3DProperties extends GeometryInstance3DProperties {
  /**
   * `visibility_aabb`, the whole box of the instance (`particles_storage.cpp:691-696`). An
   * authored `AABB()` stays empty, as the particles keep it.
   */
  visibilityAabb: Aabb;
  /** The raw `process_material` reference, which the particles and the emission gizmo read. Undefined for none. */
  processMaterial: string | undefined;
  emitter: GpuEmitter;
  /** The raw mesh reference of each draw pass up to `draw_passes`; undefined for a pass with no mesh. */
  drawPasses: Array<string | undefined>;
}
