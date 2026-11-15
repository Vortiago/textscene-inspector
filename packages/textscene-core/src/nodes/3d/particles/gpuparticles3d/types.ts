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
  /** `draw_order`; a value no order names draws in index order, as the copy shader does. */
  drawOrder: number;
  /** `trail_enabled`: each particle draws a trail through the bind poses of its mesh or skin. */
  trailEnabled: boolean;
  /** `trail_lifetime`, in seconds (`gpu_particles_3d.cpp:895`). */
  trailLifetime: number;
  /** The raw `draw_skin` reference, whose bind poses win over the mesh's. Undefined for none. */
  drawSkin: string | undefined;
  /** `transform_align`; one of the four 4.6.3 accepts. */
  transformAlign: number;
  /** The raw mesh reference of each draw pass up to `draw_passes`; undefined for a pass with no mesh. */
  drawPasses: Array<string | undefined>;
}
