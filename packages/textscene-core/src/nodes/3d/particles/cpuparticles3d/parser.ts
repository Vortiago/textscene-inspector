/** The render parse of a CPUParticles3D: its instance state, what its box reads, its emission and its simulation. */

import type { ParsedHeading } from '../../../../parser/utils';
import { heldResource } from '../../../../godot/scene/resourceLiteral';
import {
  boolOr,
  enumOr,
  floatOr,
  intOr,
  packedOr,
  parseNonEmptyAabb,
  realOr,
  realVec3Or,
  settableFloatOr,
} from '../../../../parser/valueParsers';
import { colorOr } from '../../../../utils/colorParser';
import { parsePackedColorArray, parsePackedVector3Array } from '../../../../resources/shapes/packedArray';
import { storedColor } from '../../../../godot/math/real';
import { CPUParticles3DDrawOrder } from '../../../../godot/scene/particles3d';
import { readParticleEmission } from '../../../../resources/materials/particleprocessmaterial/emission';
import { parseParticleAmount, parseParticleParams } from '../../../shared/cpuparticles/params';
import { NO_FLOATS } from '../../../shared/cpuparticles/emissionPoints';
import { parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import type { CPUParticles3DProperties, CPUParticles3DSimulation } from './types';

const DRAW_ORDERS = Object.values(CPUParticles3DDrawOrder);

export function parseCPUParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CPUParticles3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb: parseNonEmptyAabb(properties.visibility_aabb, 'visibility_aabb'),
    mesh: heldResource(properties.mesh),
    materialOverride: heldResource(properties.material_override),
    materialOverlay: heldResource(properties.material_overlay),
    emission: readParticleEmission(properties),
    simulation: parseSimulation(properties, heading.attributes.name ?? 'CPUParticles3D'),
  };
}

function parseSimulation(properties: Record<string, string>, context: string): CPUParticles3DSimulation {
  const at = (key: string) => `${context}.${key}`;
  return {
    emitting: boolOr(properties.emitting, true, at('emitting')),
    amount: parseParticleAmount(properties.amount, at('amount')),
    // `set_lifetime` refuses a lifetime that is not above zero (`cpu_particles_3d.cpp:92`).
    lifetime: settableFloatOr(properties.lifetime, 1, { min: Number.MIN_VALUE }, at('lifetime')),
    oneShot: boolOr(properties.one_shot, false, at('one_shot')),
    preprocess: floatOr(properties.preprocess, 0, at('preprocess')),
    explosiveness: realOr(properties.explosiveness, 0, at('explosiveness')),
    randomness: realOr(properties.randomness, 0, at('randomness')),
    useFixedSeed: boolOr(properties.use_fixed_seed, false, at('use_fixed_seed')),
    // `set_seed` takes a `uint32_t`, so 4294967295 is the seed the file states, not -1.
    seed: intOr(properties.seed, 0, at('seed'), 'uint32'),
    lifetimeRandomness: floatOr(properties.lifetime_randomness, 0, at('lifetime_randomness')),
    fixedFps: intOr(properties.fixed_fps, 0, at('fixed_fps')),
    speedScale: floatOr(properties.speed_scale, 1, at('speed_scale')),
    fractDelta: boolOr(properties.fract_delta, true, at('fract_delta')),
    localCoords: boolOr(properties.local_coords, false, at('local_coords')),
    drawOrder: enumOr(properties.draw_order, CPUParticles3DDrawOrder.INDEX, DRAW_ORDERS, at('draw_order')),
    alignY: boolOr(properties.particle_flag_align_y, false, at('particle_flag_align_y')),
    rotateY: boolOr(properties.particle_flag_rotate_y, false, at('particle_flag_rotate_y')),
    disableZ: boolOr(properties.particle_flag_disable_z, false, at('particle_flag_disable_z')),
    emissionPoints: packedOr(
      properties.emission_points,
      parsePackedVector3Array,
      NO_FLOATS,
      at('emission_points')
    ),
    emissionNormals: packedOr(
      properties.emission_normals,
      parsePackedVector3Array,
      NO_FLOATS,
      at('emission_normals')
    ),
    emissionColors: packedOr(
      properties.emission_colors,
      parsePackedColorArray,
      NO_FLOATS,
      at('emission_colors')
    ),
    direction: realVec3Or(properties.direction, { x: 1, y: 0, z: 0 }, at('direction')),
    spread: realOr(properties.spread, 45, at('spread')),
    flatness: realOr(properties.flatness, 0, at('flatness')),
    gravity: realVec3Or(properties.gravity, { x: 0, y: -9.8, z: 0 }, at('gravity')),
    params: parseParticleParams(properties),
    splitScale: boolOr(properties.split_scale, false, at('split_scale')),
    scaleCurves: {
      x: heldResource(properties.scale_curve_x),
      y: heldResource(properties.scale_curve_y),
      z: heldResource(properties.scale_curve_z),
    },
    color: storedColor(colorOr(properties.color, { r: 1, g: 1, b: 1, a: 1 })),
    colorRamp: heldResource(properties.color_ramp),
    colorInitialRamp: heldResource(properties.color_initial_ramp),
  };
}
