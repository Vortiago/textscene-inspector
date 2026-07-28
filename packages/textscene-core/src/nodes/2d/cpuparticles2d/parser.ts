/**
 * CPUParticles2D parser — the Node2D transform plus the emitter surface.
 *
 * The twelve parameter slots are read from a table rather than twelve hand
 * written blocks: they differ only in their serialised prefix and (for Scale)
 * their default, and Godot itself stores them as three parallel arrays.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { boolOr, enumOr, floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { colorOr } from '../../../utils/colorParser';
import {
  CPUParticles2DDrawOrder,
  CPUParticles2DEmissionShape,
  type CPUParticles2DProperties,
  type ParticleParam,
} from './types';

/** Godot's inspector range for `amount` is `1,1000000,1,exp`. */
export const MAX_PARTICLE_AMOUNT = 1_000_000;

/**
 * Serialised prefix and default for each parameter slot, in `Parameter` order.
 * The curve property is `<prefix>_curve` — except InitialLinearVelocity, which
 * Godot exposes no curve for at all.
 */
const PARAM_TABLE: ReadonlyArray<{ prefix: string; def: number; curve: boolean }> = [
  { prefix: 'initial_velocity', def: 0, curve: false },
  { prefix: 'angular_velocity', def: 0, curve: true },
  { prefix: 'orbit_velocity', def: 0, curve: true },
  { prefix: 'linear_accel', def: 0, curve: true },
  { prefix: 'radial_accel', def: 0, curve: true },
  { prefix: 'tangential_accel', def: 0, curve: true },
  { prefix: 'damping', def: 0, curve: true },
  { prefix: 'angle', def: 0, curve: true },
  { prefix: 'scale_amount', def: 1, curve: true },
  { prefix: 'hue_variation', def: 0, curve: true },
  { prefix: 'anim_speed', def: 0, curve: true },
  { prefix: 'anim_offset', def: 0, curve: true },
];

export function parseCPUParticles2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CPUParticles2DProperties {
  const base = parseNode2D(heading, properties);
  const context = base.name || 'CPUParticles2D';

  const result: CPUParticles2DProperties = {
    ...base,
    emitting: boolOr(properties.emitting, true, context),
    amount: clampAmount(intOr(properties.amount, 8, `${context}.amount`)),
    lifetime: floatOr(properties.lifetime, 1, `${context}.lifetime`),
    one_shot: boolOr(properties.one_shot, false, context),
    preprocess: floatOr(properties.preprocess, 0, `${context}.preprocess`),
    speed_scale: floatOr(properties.speed_scale, 1, `${context}.speed_scale`),
    explosiveness: floatOr(properties.explosiveness, 0, `${context}.explosiveness`),
    randomness: floatOr(properties.randomness, 0, `${context}.randomness`),
    use_fixed_seed: boolOr(properties.use_fixed_seed, false, context),
    seed: intOr(properties.seed, 0, `${context}.seed`),
    lifetime_randomness: floatOr(properties.lifetime_randomness, 0, `${context}.lifetime_randomness`),
    fixed_fps: intOr(properties.fixed_fps, 0, `${context}.fixed_fps`),
    fract_delta: boolOr(properties.fract_delta, true, context),
    local_coords: boolOr(properties.local_coords, false, context),
    draw_order: enumOr(
      properties.draw_order,
      CPUParticles2DDrawOrder.Index,
      [CPUParticles2DDrawOrder.Index, CPUParticles2DDrawOrder.Lifetime] as const,
      `${context}.draw_order`
    ),

    emission_shape: enumOr(
      properties.emission_shape,
      CPUParticles2DEmissionShape.Point,
      [
        CPUParticles2DEmissionShape.Point,
        CPUParticles2DEmissionShape.Sphere,
        CPUParticles2DEmissionShape.SphereSurface,
        CPUParticles2DEmissionShape.Rectangle,
        CPUParticles2DEmissionShape.Points,
        CPUParticles2DEmissionShape.DirectedPoints,
        CPUParticles2DEmissionShape.Ring,
      ] as const,
      `${context}.emission_shape`
    ),
    emission_sphere_radius: floatOr(properties.emission_sphere_radius, 1, context),
    emission_rect_extents: vec2Or(properties.emission_rect_extents, { x: 1, y: 1 }, context),
    emission_ring_radius: floatOr(properties.emission_ring_radius, 1, context),
    emission_ring_inner_radius: floatOr(properties.emission_ring_inner_radius, 0.8, context),

    particle_flag_align_y: boolOr(properties.particle_flag_align_y, false, context),
    direction: vec2Or(properties.direction, { x: 1, y: 0 }, `${context}.direction`),
    spread: floatOr(properties.spread, 45, `${context}.spread`),
    gravity: vec2Or(properties.gravity, { x: 0, y: 980 }, `${context}.gravity`),

    params: PARAM_TABLE.map(({ prefix, def, curve }) => {
      const param: ParticleParam = {
        min: floatOr(properties[`${prefix}_min`], def, `${context}.${prefix}_min`),
        max: floatOr(properties[`${prefix}_max`], def, `${context}.${prefix}_max`),
      };
      const ref = curve ? properties[`${prefix}_curve`] : undefined;
      if (ref) param.curve = ref;
      return param;
    }),

    color: colorOr(properties.color, { r: 1, g: 1, b: 1, a: 1 }),
  };

  if (properties.texture) result.texture = properties.texture;
  if (properties.color_ramp) result.color_ramp = properties.color_ramp;
  if (properties.color_initial_ramp) result.color_initial_ramp = properties.color_initial_ramp;

  return result;
}

/** Godot refuses `amount < 1` outright and its inspector stops at a million. */
function clampAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 8;
  return Math.min(MAX_PARTICLE_AMOUNT, Math.max(1, Math.floor(amount)));
}
