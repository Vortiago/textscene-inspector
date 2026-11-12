/** The render parse of a GPUParticles3D: its instance state, its `visibility_aabb` and its `process_material` reference. */

import type { ParsedHeading } from '../../../../parser/utils';
import { heldResource } from '../../../../godot/scene/resourceLiteral';
import {
  boolOr,
  floatOr,
  intOr,
  parseOptionalAabb,
  realOr,
  settableFloatOr,
  settableIntOr,
} from '../../../../parser/valueParsers';
import { parseParticleAmount } from '../../../shared/cpuparticles/params';
import type { GpuEmitter } from '../../../shared/gpuparticles/emitter';
import { GPU_PARTICLES_DEFAULT_VISIBILITY_AABB } from '../../../../godot/scene/gpuParticles';
import { parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import { MAX_DRAW_PASSES, type GPUParticles3DProperties } from './types';

export function parseGPUParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GPUParticles3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb:
      parseOptionalAabb(properties.visibility_aabb, 'visibility_aabb') ??
      GPU_PARTICLES_DEFAULT_VISIBILITY_AABB,
    processMaterial: properties.process_material,
    emitter: parseEmitter(properties, heading.attributes.name ?? 'GPUParticles3D'),
    drawPasses: parseDrawPasses(properties, heading.attributes.name ?? 'GPUParticles3D'),
  };
}

function parseEmitter(properties: Record<string, string>, context: string): GpuEmitter {
  const at = (key: string) => `${context}.${key}`;
  return {
    emitting: boolOr(properties.emitting, true, at('emitting')),
    amount: parseParticleAmount(properties.amount, at('amount')),
    amountRatio: realOr(properties.amount_ratio, 1, at('amount_ratio')),
    // `set_lifetime` refuses a lifetime that is not above zero (`gpu_particles_3d.cpp:83`).
    lifetime: settableFloatOr(properties.lifetime, 1, { min: Number.MIN_VALUE }, at('lifetime')),
    oneShot: boolOr(properties.one_shot, false, at('one_shot')),
    preprocess: floatOr(properties.preprocess, 0, at('preprocess')),
    explosiveness: realOr(properties.explosiveness, 0, at('explosiveness')),
    randomness: realOr(properties.randomness, 0, at('randomness')),
    fixedFps: intOr(properties.fixed_fps, 30, at('fixed_fps')),
    fractDelta: boolOr(properties.fract_delta, true, at('fract_delta')),
    localCoords: boolOr(properties.local_coords, false, at('local_coords')),
    useFixedSeed: boolOr(properties.use_fixed_seed, false, at('use_fixed_seed')),
    // `set_seed` takes a `uint32_t`, so 4294967295 is the seed the file states, not -1.
    seed: intOr(properties.seed, 0, at('seed'), 'uint32'),
    speedScale: floatOr(properties.speed_scale, 1, at('speed_scale')),
  };
}

/** The mesh of each draw pass up to `draw_passes` (`set_draw_passes` refuses less than 1, `gpu_particles_3d.cpp:266`). */
function parseDrawPasses(properties: Record<string, string>, context: string): Array<string | undefined> {
  const count = settableIntOr(properties.draw_passes, 1, { min: 1 }, `${context}.draw_passes`);
  return Array.from({ length: Math.min(count, MAX_DRAW_PASSES) }, (_, pass) =>
    heldResource(properties[`draw_pass_${pass + 1}`])
  );
}
